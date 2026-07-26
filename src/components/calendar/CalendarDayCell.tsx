"use client";

import { formatDate } from "@/lib/dates";
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
    // Priority density signal: A / B / C when present
    const pri =
      (summary.tasks.hasA ? "A" : "") +
      (summary.tasks.hasB ? "B" : "") +
      (summary.tasks.hasC ? "C" : "");
    badges.push({
      label: pri
        ? `${summary.tasks.done}/${summary.tasks.total}${pri}`
        : `${summary.tasks.done}/${summary.tasks.total}T`,
      bg: allDone ? "rgba(94,207,138,0.18)" : "rgba(240,113,120,0.15)",
      color: allDone ? "#5ecf8a" : "#f07178",
    });
  }

  if (summary.habits.completed > 0 || summary.habits.total > 0) {
    const allDone = summary.habits.completed === summary.habits.total && summary.habits.total > 0;
    badges.push({
      label: `${summary.habits.completed}/${summary.habits.total}H`,
      bg: allDone ? "rgba(94,207,138,0.18)" : "rgba(167,139,250,0.15)",
      color: allDone ? "#5ecf8a" : "#a78bfa",
    });
  }

  // Habit color dots when available
  if (summary.habits.colors?.length > 0) {
    // Encoded as a short "···" badge using first color
    badges.push({
      label: "●".repeat(Math.min(3, summary.habits.colors.length)),
      bg: "transparent",
      color: summary.habits.colors[0],
    });
  }

  if (summary.journal.hasEntry) {
    badges.push({
      label: summary.journal.mood ? ["", "😞", "😕", "😐", "🙂", "😄"][summary.journal.mood] : "J",
      bg: "rgba(143,181,242,0.18)",
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

  // Screen readers otherwise hear just "15, button" with no month/year or
  // activity context, and no way to tell the selected day apart.
  const activity: string[] = [];
  if (summary) {
    if (summary.tasks.total > 0) activity.push(`${summary.tasks.done} of ${summary.tasks.total} tasks done`);
    if (summary.habits.total > 0) activity.push(`${summary.habits.completed} of ${summary.habits.total} habits`);
    if (summary.journal.hasEntry) activity.push("journal entry");
    if (summary.workouts.count > 0) activity.push(`${summary.workouts.count} workout${summary.workouts.count > 1 ? "s" : ""}`);
    if (summary.focus.sessions > 0) activity.push(`${summary.focus.minutes} min focus`);
  }
  const ariaLabel = `${formatDate(date, "long")}${isToday ? " (today)" : ""}, ${activity.length ? activity.join(", ") : "no activity"}`;

  return (
    <button
      onClick={() => onClick(date)}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
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
