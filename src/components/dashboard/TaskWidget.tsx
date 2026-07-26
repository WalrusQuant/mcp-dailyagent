"use client";

import { CheckSquare } from "lucide-react";
import { Task } from "@/types/database";
import { WidgetCard } from "@/components/shared/WidgetCard";

interface TaskWidgetProps {
  total: number;
  done: number;
  topPriorities: Task[];
}

function priorityColor(priority: string): string {
  const letter = priority[0];
  if (letter === "A") return "var(--accent-negative)";
  if (letter === "B") return "var(--accent-warning)";
  return "var(--accent-positive)";
}

export function TaskWidget({ total, done, topPriorities }: TaskWidgetProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <WidgetCard
      href="/tasks"
      title="Tasks"
      icon={CheckSquare}
      domainColor="var(--domain-tasks)"
      meta={`${done}/${total}`}
    >
      <div className="progress-track mb-3.5">
        <div className="progress-fill" style={{ width: `${pct}%`, background: "var(--domain-tasks)" }} />
      </div>

      {topPriorities.length > 0 ? (
        <div className="space-y-1.5">
          {topPriorities.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <span
                className="text-[11px] font-semibold tabular-nums w-5 shrink-0"
                style={{ color: priorityColor(t.priority) }}
              >
                {t.priority}
              </span>
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="caption">No open tasks</p>
      )}
    </WidgetCard>
  );
}
