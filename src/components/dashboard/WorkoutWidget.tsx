"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";

interface WorkoutWidgetProps {
  todayLog: { name: string } | null;
  weekCount: number;
}

export function WorkoutWidget({ todayLog, weekCount }: WorkoutWidgetProps) {
  return (
    <Link
      href="/workouts"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell className="w-4 h-4" style={{ color: "#f59e0b" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Workouts</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{weekCount} this week</span>
      </div>

      {todayLog ? (
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {todayLog.name} ✓
        </span>
      ) : (
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Start a workout →
        </span>
      )}
    </Link>
  );
}
