import { describe, expect, it } from "vitest";
import { createDateContext, zonedDate, zonedDayRange, zonedDateRange } from "@/lib/date-context";

describe("profile timezone date context", () => {
  it("computes today independently of the runtime timezone", () => {
    const instant = new Date("2026-08-02T01:30:00.000Z");
    expect(createDateContext("America/Chicago", instant).today).toBe("2026-08-01");
    expect(createDateContext("Asia/Kathmandu", instant).today).toBe("2026-08-02");
  });

  it("groups timestamps using the profile timezone", () => {
    expect(zonedDate(new Date("2026-01-01T00:30:00Z"), "America/New_York")).toBe("2025-12-31");
  });

  it("creates a 23-hour spring-forward day", () => {
    const { start, end } = zonedDayRange("2026-03-08", "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("creates a 25-hour fall-back day", () => {
    const { start, end } = zonedDayRange("2026-11-01", "America/New_York");
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("starts at the first valid instant when DST skips local midnight", () => {
    const { start, end } = zonedDayRange("2018-11-04", "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(end.toISOString()).toBe("2018-11-05T02:00:00.000Z");
  });

  it("uses a half-open upper bound for inclusive calendar ranges", () => {
    const range = zonedDateRange("2026-08-01", "2026-08-07", "Pacific/Kiritimati");
    expect(range.start.toISOString()).toBe("2026-07-31T10:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-07T10:00:00.000Z");
  });

  it("falls back safely when a stored timezone is invalid", () => {
    expect(createDateContext("Mars/Olympus", new Date("2026-08-01T23:00:00Z"))).toMatchObject({ timezone: "UTC", today: "2026-08-01" });
  });
});
