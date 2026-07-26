"use client";

import { Timer } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";

interface FocusWidgetProps {
  todayMinutes: number;
  todaySessions: number;
}

export function FocusWidget({ todayMinutes, todaySessions }: FocusWidgetProps) {
  return (
    <WidgetCard
      href="/focus"
      title="Focus"
      icon={Timer}
      domainColor="var(--domain-focus)"
    >
      <div className="flex items-end gap-6">
        <div>
          <div
            className="text-2xl font-semibold tracking-tight tabular-nums leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {todayMinutes}
            <span className="text-sm font-medium ml-0.5" style={{ color: "var(--text-muted)" }}>m</span>
          </div>
          <div className="caption mt-1">focus time</div>
        </div>
        <div>
          <div
            className="text-2xl font-semibold tracking-tight tabular-nums leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {todaySessions}
          </div>
          <div className="caption mt-1">sessions</div>
        </div>
      </div>
    </WidgetCard>
  );
}
