"use client";

import { Pencil, Trash2, CalendarDays, CheckSquare, Target } from "lucide-react";
import { Goal } from "@/types/database";

interface GoalItemProps {
  goal: Goal;
  taskCount?: number;
  habitCount?: number;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onClick: (goal: Goal) => void;
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

export function GoalItem({ goal, taskCount = 0, habitCount = 0, onEdit, onDelete, onClick }: GoalItemProps) {
  const categoryColor = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.other;

  const daysLeft = goal.target_date
    ? Math.ceil((new Date(goal.target_date + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;

  return (
    <div
      className="group rounded-xl p-4 transition-colors cursor-pointer"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onClick={() => onClick(goal)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase"
              style={{ background: `${categoryColor}20`, color: categoryColor }}
            >
              {goal.category}
            </span>
            {goal.status !== "active" && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase"
                style={{ color: "var(--text-muted)", background: "var(--bg-base)" }}
              >
                {goal.status}
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {goal.title}
          </h3>
        </div>
        <div className="hidden group-hover:flex items-center gap-0 shrink-0 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
            className="p-1 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(goal); }}
            className="p-1 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full mb-2" style={{ background: "var(--bg-base)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${goal.progress}%`, background: categoryColor }}
        />
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="font-medium" style={{ color: categoryColor }}>{goal.progress}%</span>

        {daysLeft !== null && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Today" : `${Math.abs(daysLeft)}d overdue`}
          </span>
        )}

        {taskCount > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            {taskCount} task{taskCount !== 1 ? "s" : ""}
          </span>
        )}

        {habitCount > 0 && (
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            {habitCount} habit{habitCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
