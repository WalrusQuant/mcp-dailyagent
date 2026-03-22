"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Habit } from "@/types/database";
import { SparklineChart } from "@/components/shared/SparklineChart";

interface HabitRowProps {
  habit: Habit;
  weekDates: string[];
  loggedDates: Set<string>;
  streak: number;
  completionRate: number;
  recentData: number[];
  onToggle: (habitId: string, date: string) => void;
  onNameClick: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export function HabitRow({ habit, weekDates, loggedDates, streak, completionRate, recentData, onToggle, onNameClick, onEdit, onDelete }: HabitRowProps) {
  return (
    <div
      className="group flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-3 py-2.5 rounded-lg transition-colors"
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = ""}
    >
      {/* Row 1 (mobile) / inline (desktop): dot + name + actions */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: habit.color }}
        />

        <button
          onClick={onNameClick}
          className="text-sm font-medium flex-1 md:flex-none md:w-32 truncate text-left hover:underline"
          style={{ color: "var(--text-primary)" }}
        >
          {habit.name}
        </button>

        {/* Mobile-only action buttons */}
        <div className="flex md:hidden items-center gap-0 shrink-0">
          <button onClick={() => onEdit(habit)} className="p-2" style={{ color: "var(--text-muted)" }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(habit)} className="p-2" style={{ color: "var(--text-muted)" }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2 (mobile) / inline (desktop): day toggles */}
      <div className="flex gap-1.5 flex-shrink-0">
        {weekDates.map((date) => {
          const isLogged = loggedDates.has(date);
          return (
            <button
              key={date}
              onClick={() => onToggle(habit.id, date)}
              className="flex-1 md:flex-none md:w-7 h-11 md:h-7 rounded-md flex items-center justify-center transition-colors"
              style={{
                background: isLogged ? habit.color : "var(--bg-base)",
                border: `1px solid ${isLogged ? habit.color : "var(--border-default)"}`,
              }}
            >
              {isLogged && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 3 (mobile) / inline (desktop): stats + desktop actions */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {completionRate > 0 && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
            {Math.round(completionRate * 100)}%
          </span>
        )}
        {streak > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--accent-primary)" }}>
            {streak}d streak
          </span>
        )}

        <SparklineChart data={recentData} color={habit.color} />

        {/* Desktop-only hover action buttons */}
        <div className="hidden md:group-hover:flex items-center gap-0 shrink-0">
          <button onClick={() => onEdit(habit)} className="p-1" style={{ color: "var(--text-muted)" }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(habit)} className="p-1" style={{ color: "var(--text-muted)" }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
