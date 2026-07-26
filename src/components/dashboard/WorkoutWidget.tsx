"use client";

import { Dumbbell } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";

interface WorkoutWidgetProps {
  todayLog: { name: string } | null;
  weekCount: number;
}

export function WorkoutWidget({ todayLog, weekCount }: WorkoutWidgetProps) {
  return (
    <WidgetCard
      href="/workouts"
      title="Workouts"
      icon={Dumbbell}
      domainColor="var(--domain-workouts)"
      meta={`${weekCount} this week`}
    >
      {todayLog ? (
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {todayLog.name}
          <span className="ml-1.5" style={{ color: "var(--accent-positive)" }}>✓</span>
        </span>
      ) : (
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Start a workout →
        </span>
      )}
    </WidgetCard>
  );
}
