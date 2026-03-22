"use client";

import Link from "next/link";
import { Crosshair } from "lucide-react";

interface GoalSummary {
  id: string;
  title: string;
  progress: number;
  category: string;
  target_date: string | null;
}

interface GoalWidgetProps {
  activeCount: number;
  topGoals: GoalSummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  health: "#22c55e",
  career: "#3b82f6",
  personal: "#d4a574",
  financial: "#f59e0b",
  learning: "#8b5cf6",
  relationships: "#ec4899",
  other: "#94a3b8",
};

export function GoalWidget({ activeCount, topGoals }: GoalWidgetProps) {
  return (
    <Link
      href="/goals"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <Crosshair className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Goals</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{activeCount} active</span>
      </div>

      {topGoals.length > 0 ? (
        <div className="space-y-2">
          {topGoals.slice(0, 3).map((g) => {
            const color = CATEGORY_COLORS[g.category] || CATEGORY_COLORS.other;
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{g.title}</span>
                  <span className="text-xs font-medium ml-2" style={{ color }}>{g.progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: "var(--bg-base)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${g.progress}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No active goals</p>
      )}
    </Link>
  );
}
