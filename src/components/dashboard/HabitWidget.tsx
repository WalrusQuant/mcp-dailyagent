"use client";

import Link from "next/link";
import { Target } from "lucide-react";

interface HabitWidgetProps {
  total: number;
  completedToday: number;
  streak: number;
}

export function HabitWidget({ total, completedToday, streak }: HabitWidgetProps) {
  const pct = total > 0 ? Math.round((completedToday / total) * 100) : 0;

  return (
    <Link
      href="/habits"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4" style={{ color: "#22c55e" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Habits</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{pct}%</span>
      </div>

      <div className="w-full h-2 rounded-full mb-3" style={{ background: "var(--bg-base)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "#22c55e" }}
        />
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{completedToday}/{total} today</span>
        {streak > 0 && <span>{streak}d streak</span>}
      </div>
    </Link>
  );
}
