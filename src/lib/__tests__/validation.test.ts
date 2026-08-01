import { describe, expect, it } from "vitest";
import {
  calendarDateSchema,
  ianaTimezoneSchema,
  isOrderedDateRange,
  isOrderedTimestampRange,
  isoTimestampSchema,
  orderedDateRangeSchema,
  recurrenceSchema,
  uuidSchema,
  yearMonthSchema,
} from "@/lib/validation";

describe("calendar validation", () => {
  it.each(["2024-02-29", "2000-02-29", "2026-12-31"])("accepts %s", (date) => {
    expect(calendarDateSchema.safeParse(date).success).toBe(true);
  });

  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "2026-2-01"])(
    "rejects impossible or malformed date %s",
    (date) => expect(calendarDateSchema.safeParse(date).success).toBe(false)
  );

  it("validates real year-month values", () => {
    expect(yearMonthSchema.safeParse("2026-12").success).toBe(true);
    expect(yearMonthSchema.safeParse("2026-13").success).toBe(false);
    expect(yearMonthSchema.safeParse("0000-01").success).toBe(false);
  });
});

describe("range and identity validation", () => {
  const rangeSchema = orderedDateRangeSchema({
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
  });

  it("rejects inverted date ranges", () => {
    expect(rangeSchema.safeParse({ from: "2026-08-02", to: "2026-08-01" }).success).toBe(false);
    expect(isOrderedDateRange("2026-08-02", "2026-08-01")).toBe(false);
  });

  it("accepts partial and ordered ranges", () => {
    expect(rangeSchema.safeParse({ from: "2026-08-01", to: "2026-08-01" }).success).toBe(true);
    expect(rangeSchema.safeParse({ from: "2026-08-01" }).success).toBe(true);
  });

  it("accepts Postgres-shaped UUIDs", () => {
    expect(uuidSchema.safeParse("00000000-0000-0000-0000-000000000001").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("timezone and recurrence validation", () => {
  it("accepts supported IANA timezones and rejects invented zones", () => {
    expect(ianaTimezoneSchema.safeParse("America/Chicago").success).toBe(true);
    expect(ianaTimezoneSchema.safeParse("UTC").success).toBe(true);
    expect(ianaTimezoneSchema.safeParse("Mars/Olympus_Mons").success).toBe(false);
  });

  it("validates and orders ISO timestamps by instant", () => {
    expect(isoTimestampSchema.safeParse("2026-08-01T12:00:00.000Z").success).toBe(true);
    expect(isoTimestampSchema.safeParse("2026-08-01").success).toBe(false);
    expect(isoTimestampSchema.safeParse("not-a-date").success).toBe(false);
    expect(isOrderedTimestampRange("2026-08-01T12:00:00-05:00", "2026-08-01T18:00:00Z")).toBe(true);
    expect(isOrderedTimestampRange("2026-08-01T19:00:00Z", "2026-08-01T12:00:00-05:00")).toBe(false);
  });

  it("requires recurrence fields to match their type", () => {
    expect(recurrenceSchema.safeParse({ type: "weekly", days: [1, 3, 7] }).success).toBe(true);
    expect(recurrenceSchema.safeParse({ type: "weekly", days: [1, 1] }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ type: "weekly", days: [] }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ type: "daily", days: [1] }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ type: "weekly", days: [0] }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ type: "fortnightly" }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ type: "daily", extra: true }).success).toBe(false);
  });
});
