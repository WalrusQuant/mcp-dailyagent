"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatRelativeDate, addDays, isToday, startOfWeek, endOfWeek, formatDate, getToday } from "@/lib/dates";

interface DateNavigationProps {
  date: string;
  onDateChange: (date: string) => void;
  mode?: "day" | "week";
  /** Latest navigable date (YYYY-MM-DD). Disables forward nav past it. */
  maxDate?: string;
}

export function DateNavigation({ date, onDateChange, mode = "day", maxDate }: DateNavigationProps) {
  const nextDisabled = maxDate
    ? mode === "week"
      ? startOfWeek(date) >= startOfWeek(maxDate)
      : date >= maxDate
    : false;

  const handlePrev = () => {
    onDateChange(addDays(date, mode === "week" ? -7 : -1));
  };

  const handleNext = () => {
    if (nextDisabled) return;
    onDateChange(addDays(date, mode === "week" ? 7 : 1));
  };

  const displayText = mode === "week"
    ? `${formatDate(startOfWeek(date))} – ${formatDate(endOfWeek(date))}`
    : formatRelativeDate(date);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        aria-label={mode === "week" ? "Previous week" : "Previous day"}
        className="p-1.5 rounded-lg transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span
        className="text-sm font-medium text-center sm:min-w-[140px]"
        style={{ color: "var(--text-primary)" }}
      >
        {displayText}
      </span>
      <button
        onClick={handleNext}
        disabled={nextDisabled}
        aria-label={mode === "week" ? "Next week" : "Next day"}
        className="p-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:opacity-30"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {!isToday(date) && mode === "day" && (
        <button
          onClick={() => onDateChange(getToday())}
          className="text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: "var(--accent-primary)", background: "var(--bg-elevated)" }}
        >
          Today
        </button>
      )}
    </div>
  );
}
