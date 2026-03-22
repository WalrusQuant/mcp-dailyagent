"use client";

import { getToday, addDays } from "@/lib/dates";

interface HabitStatsProps {
  habitName: string;
  color: string;
  streak: number;
  completionRate: number;
  loggedDates: Set<string>;
}

export function HabitStats({ habitName, color, streak, completionRate, loggedDates }: HabitStatsProps) {
  // Build 30-day grid (5 rows x 6 cols)
  const today = getToday();
  const days: { date: string; logged: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    days.push({ date: d, logged: loggedDates.has(d) });
  }

  return (
    <div
      className="px-4 py-3 rounded-lg mb-0.5"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {habitName} — 30 Day View
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--accent-primary)" }}>
            {streak}d streak
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {Math.round(completionRate * 100)}% rate
          </span>
        </div>
      </div>

      <div className="grid grid-cols-6 md:grid-cols-10 gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            className="aspect-square rounded-sm"
            style={{
              background: day.logged ? color : "var(--bg-elevated)",
              opacity: day.logged ? 0.85 : 0.4,
            }}
            title={day.date}
          />
        ))}
      </div>
    </div>
  );
}
