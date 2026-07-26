"use client";

import { Target } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";

interface HabitWidgetProps {
  total: number;
  completedToday: number;
  streak: number;
}

export function HabitWidget({ total, completedToday, streak }: HabitWidgetProps) {
  const pct = total > 0 ? Math.round((completedToday / total) * 100) : 0;

  return (
    <WidgetCard
      href="/habits"
      title="Habits"
      icon={Target}
      domainColor="var(--domain-habits)"
      meta={`${pct}%`}
    >
      <div className="progress-track mb-3.5">
        <div className="progress-fill" style={{ width: `${pct}%`, background: "var(--domain-habits)" }} />
      </div>

      <div className="flex items-center justify-between caption">
        <span>
          {completedToday}/{total} today
        </span>
        {streak > 0 && (
          <span style={{ color: "var(--accent-warning)" }}>{streak}d streak</span>
        )}
      </div>
    </WidgetCard>
  );
}
