import { addDays } from "@/lib/dates";
import { isIanaTimezone } from "@/lib/validation";

export interface DateContext { timezone: string; now: Date; today: string }
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string, withTime = false): Intl.DateTimeFormat {
  const cache = withTime ? dateTimeFormatters : dateFormatters;
  let value = cache.get(timezone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", withTime
      ? { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }
      : { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    cache.set(timezone, value);
  }
  return value;
}

function parts(value: Date, timezone: string, withTime = false): Record<string, number> {
  return Object.fromEntries(formatter(timezone, withTime).formatToParts(value)
    .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function zonedDate(value: Date, timezone: string): string {
  const p = parts(value, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function zonedHour(value: Date, timezone: string): number {
  return parts(value, timezone, true).hour;
}

/** Return the first instant belonging to a calendar date in the given zone. */
export function zonedDateTimeToInstant(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const nominal = Date.UTC(year, month - 1, day);
  let low = nominal - 36 * 60 * 60 * 1000;
  let high = nominal + 36 * 60 * 60 * 1000;

  // Calendar dates are monotonic within one IANA zone. Finding the lower
  // boundary also handles DST transitions that skip local midnight.
  while (low < high) {
    const midpoint = low + Math.floor((high - low) / 2);
    if (zonedDate(new Date(midpoint), timezone) < date) low = midpoint + 1;
    else high = midpoint;
  }
  return new Date(low);
}

export function zonedDayRange(date: string, timezone: string): { start: Date; end: Date } {
  return { start: zonedDateTimeToInstant(date, timezone), end: zonedDateTimeToInstant(addDays(date, 1), timezone) };
}

export function zonedDateRange(from: string, to: string, timezone: string): { start: Date; end: Date } {
  return { start: zonedDateTimeToInstant(from, timezone), end: zonedDateTimeToInstant(addDays(to, 1), timezone) };
}

export function createDateContext(timezone: string, now = new Date()): DateContext {
  const validTimezone = isIanaTimezone(timezone) ? timezone : "UTC";
  return { timezone: validTimezone, now, today: zonedDate(now, validTimezone) };
}
