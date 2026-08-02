import { describe, expect, it } from "vitest";
import { nextOccurrenceDate, parseRecurrenceRule } from "@/lib/tasks/recurrence";

describe("nextOccurrenceDate", () => {
  it("advances daily across leap days and year boundaries", () => {
    expect(nextOccurrenceDate("2024-02-28", { type: "daily" }, "2024-02-28")).toBe("2024-02-29");
    expect(nextOccurrenceDate("2026-12-31", { type: "daily" }, "2026-12-31")).toBe("2027-01-01");
  });

  it("skips weekends for weekday cadence", () => {
    expect(nextOccurrenceDate("2026-07-31", { type: "weekdays" }, "2026-07-31")).toBe("2026-08-03");
    expect(nextOccurrenceDate("2026-08-03", { type: "weekdays" }, "2026-07-31")).toBe("2026-08-04");
  });

  it("uses the next selected ISO weekday", () => {
    const rule = { type: "weekly" as const, days: [1, 3, 5] };
    expect(nextOccurrenceDate("2026-07-31", rule, "2026-07-31")).toBe("2026-08-03");
    expect(nextOccurrenceDate("2026-08-03", rule, "2026-07-31")).toBe("2026-08-05");
  });

  it("defaults weekly cadence to seven days", () => {
    expect(nextOccurrenceDate("2026-12-28", { type: "weekly" }, "2026-12-28")).toBe("2027-01-04");
  });

  it("preserves a monthly anchor through short months", () => {
    const rule = { type: "monthly" as const };
    expect(nextOccurrenceDate("2024-01-31", rule, "2024-01-31")).toBe("2024-02-29");
    expect(nextOccurrenceDate("2024-02-29", rule, "2024-01-31")).toBe("2024-03-31");
    expect(nextOccurrenceDate("2025-01-31", rule, "2025-01-31")).toBe("2025-02-28");
    expect(nextOccurrenceDate("2025-12-31", rule, "2025-01-31")).toBe("2026-01-31");
  });
});

describe("parseRecurrenceRule", () => {
  it("accepts supported rules and rejects invalid legacy JSON", () => {
    expect(parseRecurrenceRule({ type: "weekly", days: [1, 7] })).toEqual({
      type: "weekly",
      days: [1, 7],
    });
    expect(parseRecurrenceRule({ type: "weekly", days: [1, 1] })).toBeNull();
    expect(parseRecurrenceRule({ type: "fortnightly" })).toBeNull();
  });
});
