export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDate(date: string, mode: "short" | "long" = "short"): string {
  const d = new Date(date + "T00:00:00");
  if (mode === "long") {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function startOfWeek(date: string): string {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0];
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
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  return day === 0 ? 7 : day; // 1=Mon, 7=Sun
}

export function startOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function endOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

export function addMonths(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getCalendarGridDates(yearMonth: string): string[] {
  const firstDay = startOfMonth(yearMonth);
  const lastDay = endOfMonth(yearMonth);
  const gridStart = startOfWeek(firstDay);
  const gridEnd = endOfWeek(lastDay);
  return getDateRange(gridStart, gridEnd);
}
