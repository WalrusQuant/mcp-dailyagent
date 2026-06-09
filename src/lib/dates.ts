// All functions operate on "YYYY-MM-DD" date strings. Arithmetic is done on
// date components via Date.UTC and read back with getUTC* so results are
// identical in every timezone — never round-trip a local Date through
// toISOString(), which shifts the day for any UTC offset.

function parseDateParts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The current calendar date where this code runs (browser: user's day; server: container TZ). */
export function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar date of a timestamp in the runtime's timezone — same day convention as getToday(). */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(date: string, mode: "short" | "long" = "short"): string {
  const [y, m, d] = parseDateParts(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (mode === "long") {
    return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDateParts(date);
  return formatUtcDate(new Date(Date.UTC(y, m - 1, d + days)));
}

export function startOfWeek(date: string): string {
  const [y, m, d] = parseDateParts(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  return formatUtcDate(new Date(Date.UTC(y, m - 1, d - diff)));
}

export function endOfWeek(date: string): string {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

export function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function isToday(date: string): boolean {
  return date === getToday();
}

export function formatRelativeDate(date: string): string {
  const today = getToday();
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  if (date === addDays(today, 1)) return "Tomorrow";
  return formatDate(date, "long");
}

export function getDayOfWeek(date: string): number {
  const [y, m, d] = parseDateParts(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day; // 1=Mon, 7=Sun
}

export function startOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function endOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

export function addMonths(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function getCalendarGridDates(yearMonth: string): string[] {
  const firstDay = startOfMonth(yearMonth);
  const lastDay = endOfMonth(yearMonth);
  const gridStart = startOfWeek(firstDay);
  const gridEnd = endOfWeek(lastDay);
  return getDateRange(gridStart, gridEnd);
}
