"use client";

import type { DaySummary } from "./types";

interface CalendarDayCellProps {
  date: string;
  currentMonth: string;
  isToday: boolean;
  isSelected: boolean;
  summary: DaySummary | undefined;
  onClick: (date: string) => void;
}

interface Badge {
  label: string;
  bg: string;
  color: string;
}

function getBadges(summary: DaySummary): Badge[] {
  const badges: Badge[] = [];

  if (summary.tasks.total > 0) {
    const allDone = summary.tasks.done === summary.tasks.total;
    badges.push({
      label: `${summary.tasks.done}/${summary.tasks.total}T`,
      bg: allDone ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.15)",
      color: allDone ? "#22c55e" : "#ef4444",
    });
  }

  if (summary.habits.completed > 0 || summary.habits.total > 0) {
    const allDone = summary.habits.completed === summary.habits.total && summary.habits.total > 0;
    badges.push({
      label: `${summary.habits.completed}/${summary.habits.total}H`,
      bg: allDone ? "rgba(34,197,94,0.18)" : "rgba(168,85,247,0.15)",
      color: allDone ? "#22c55e" : "#a855f7",
    });
  }

  if (summary.journal.hasEntry) {
    badges.push({
      label: summary.journal.mood ? ["", "😞", "😕", "😐", "🙂", "😄"][summary.journal.mood] : "J",
      bg: "rgba(212,165,116,0.18)",
      color: "var(--accent-primary)",
    });
  }

  if (summary.workouts.count > 0) {
    badges.push({
      label: `${summary.workouts.count}W`,
      bg: "rgba(139,92,246,0.18)",
      color: "#8b5cf6",
    });
  }

  if (summary.focus.sessions > 0) {
    badges.push({
      label: `${summary.focus.minutes}m`,
      bg: "rgba(59,130,246,0.15)",
      color: "#3b82f6",
    });
  }

  return badges;
}

export function CalendarDayCell({
  date,
  currentMonth,
  isToday,
  isSelected,
  summary,
  onClick,
}: CalendarDayCellProps) {
  const dayNum = parseInt(date.split("-")[2], 10);
  const dateMonth = date.slice(0, 7);
  const isOutsideMonth = dateMonth !== currentMonth;
  const badges = summary ? getBadges(summary) : [];

  return (
    <button
      onClick={() => onClick(date)}
      className="relative flex flex-col items-start p-1 md:p-2 transition-colors overflow-hidden w-full h-full"
      style={{
        borderRight: "1px solid var(--border-default)",
        borderBottom: "1px solid var(--border-default)",
        background: isSelected
          ? "var(--bg-elevated)"
          : isOutsideMonth
            ? "var(--bg-surface)"
            : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          e.currentTarget.style.background = isOutsideMonth ? "var(--bg-surface)" : "";
      }}
    >
      {/* Day number */}
      <span
        className={`text-xs md:text-sm leading-none ${
          isToday
            ? "w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full font-semibold"
            : "font-medium"
        }`}
        style={{
          color: isToday
            ? "var(--bg-base)"
            : isOutsideMonth
              ? "var(--text-muted)"
              : "var(--text-primary)",
          background: isToday ? "var(--accent-primary)" : undefined,
        }}
      >
        {dayNum}
      </span>

      {/* Stacked pill badges */}
      {badges.length > 0 && (
        <div className="mt-1 md:mt-auto w-full flex flex-wrap gap-[3px] md:gap-1">
          {badges.map((badge, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-sm px-1 md:px-1.5 py-px text-[9px] md:text-[10px] font-medium leading-tight"
              style={{
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 2px var(--accent-primary)" }}
        />
      )}
    </button>
  );
}
