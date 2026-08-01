import { z } from "zod";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isYearMonth(value: string): boolean {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && month >= 1 && month <= 12;
}

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "Must be a real date in YYYY-MM-DD format");

export const yearMonthSchema = z
  .string()
  .refine(isYearMonth, "Must be a real month in YYYY-MM format");

export const uuidSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Must be a valid UUID"
);

export const ianaTimezoneSchema = z
  .string()
  .refine(isIanaTimezone, "Must be a valid IANA timezone");

export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO 8601 timestamp with a timezone" });

export const recurrenceSchema = z
  .object({
    type: z.enum(["daily", "weekdays", "weekly", "monthly"]),
    days: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.type !== "weekly" && rule.days !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days"],
        message: "days is only valid for weekly recurrence",
      });
    }

    if (rule.days && new Set(rule.days).size !== rule.days.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days"],
        message: "Weekly recurrence days must be unique",
      });
    }
  });

export const nullableRecurrenceSchema = recurrenceSchema.nullable();

export function orderedDateRangeSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((range, context) => {
    const values = range as Record<string, unknown>;
    const from = values.from;
    const to = values.to;
    if (typeof from === "string" && typeof to === "string" && from > to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must be on or after start date",
      });
    }
  });
}

export function isOrderedDateRange(from?: string, to?: string): boolean {
  return from === undefined || to === undefined || from <= to;
}

export function isOrderedTimestampRange(from?: string, to?: string): boolean {
  return from === undefined || to === undefined || Date.parse(from) <= Date.parse(to);
}
