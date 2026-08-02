import { recurrenceSchema } from "@/lib/validation";

export type RecurrenceRule = {
  type: "daily" | "weekdays" | "weekly" | "monthly";
  days?: number[];
};

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function formatDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addCalendarDays(value: string, amount: number): string {
  const { year, month, day } = parseDate(value);
  return formatDate(new Date(Date.UTC(year, month - 1, day + amount)));
}

function isoWeekday(value: string): number {
  const { year, month, day } = parseDate(value);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Return the scheduled date after `scheduledDate`. Calendar math is UTC-only
 * because these are date-only values, not instants. Monthly series always use
 * their original anchor day and clamp it to the destination month.
 */
export function nextOccurrenceDate(
  scheduledDate: string,
  rule: RecurrenceRule,
  anchorDate: string
): string {
  switch (rule.type) {
    case "daily":
      return addCalendarDays(scheduledDate, 1);
    case "weekdays": {
      let next = addCalendarDays(scheduledDate, 1);
      while (isoWeekday(next) > 5) next = addCalendarDays(next, 1);
      return next;
    }
    case "weekly": {
      if (!rule.days) return addCalendarDays(scheduledDate, 7);
      let next = addCalendarDays(scheduledDate, 1);
      while (!rule.days.includes(isoWeekday(next))) next = addCalendarDays(next, 1);
      return next;
    }
    case "monthly": {
      const current = parseDate(scheduledDate);
      const anchorDay = parseDate(anchorDate).day;
      const nextMonth = current.month === 12 ? 1 : current.month + 1;
      const nextYear = current.month === 12 ? current.year + 1 : current.year;
      const day = Math.min(anchorDay, daysInMonth(nextYear, nextMonth));
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
}

export function parseRecurrenceRule(value: unknown): RecurrenceRule | null {
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
