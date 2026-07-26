"use client";

import { Crosshair } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";

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
  health: "var(--domain-habits)",
  career: "var(--domain-focus)",
  personal: "var(--domain-goals)",
  financial: "var(--domain-workouts)",
  learning: "var(--domain-journal)",
  relationships: "var(--accent-negative)",
  other: "var(--text-muted)",
};

export function GoalWidget({ activeCount, topGoals }: GoalWidgetProps) {
  return (
    <WidgetCard
      href="/goals"
      title="Goals"
      icon={Crosshair}
      domainColor="var(--domain-goals)"
      meta={`${activeCount} active`}
    >
      {topGoals.length > 0 ? (
        <div className="space-y-2.5">
          {topGoals.slice(0, 3).map((g) => {
            const color = CATEGORY_COLORS[g.category] || CATEGORY_COLORS.other;
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>
                    {g.title}
                  </span>
                  <span className="text-[11px] font-semibold ml-2 tabular-nums" style={{ color }}>
                    {g.progress}%
                  </span>
                </div>
                <div className="progress-track" style={{ height: "0.3rem" }}>
                  <div className="progress-fill" style={{ width: `${g.progress}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="caption">No active goals</p>
      )}
    </WidgetCard>
  );
}
