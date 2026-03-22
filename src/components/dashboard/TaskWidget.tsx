"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { Task } from "@/types/database";

interface TaskWidgetProps {
  total: number;
  done: number;
  topPriorities: Task[];
}

export function TaskWidget({ total, done, topPriorities }: TaskWidgetProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href="/tasks"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Tasks</span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{done}/{total}</span>
      </div>

      <div className="w-full h-2 rounded-full mb-3" style={{ background: "var(--bg-base)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--accent-primary)" }}
        />
      </div>

      {topPriorities.length > 0 && (
        <div className="space-y-1">
          {topPriorities.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="font-bold" style={{ color: t.priority[0] === "A" ? "#ef4444" : t.priority[0] === "B" ? "#f59e0b" : "#22c55e" }}>
                {t.priority}
              </span>
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
