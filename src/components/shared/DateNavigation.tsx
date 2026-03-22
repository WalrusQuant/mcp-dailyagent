"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatRelativeDate, addDays, isToday, startOfWeek, endOfWeek, formatDate } from "@/lib/dates";

interface DateNavigationProps {
  date: string;
  onDateChange: (date: string) => void;
  mode?: "day" | "week";
}

export function DateNavigation({ date, onDateChange, mode = "day" }: DateNavigationProps) {
  const handlePrev = () => {
    onDateChange(addDays(date, mode === "week" ? -7 : -1));
  };

  const handleNext = () => {
    onDateChange(addDays(date, mode === "week" ? 7 : 1));
  };

  const displayText = mode === "week"
    ? `${formatDate(startOfWeek(date))} – ${formatDate(endOfWeek(date))}`
    : formatRelativeDate(date);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        className="p-1.5 rounded-lg transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span
        className="text-sm font-medium min-w-[140px] text-center"
        style={{ color: "var(--text-primary)" }}
      >
        {displayText}
      </span>
      <button
        onClick={handleNext}
        className="p-1.5 rounded-lg transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {!isToday(date) && mode === "day" && (
        <button
          onClick={() => onDateChange(new Date().toISOString().split("T")[0])}
          className="text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: "var(--accent-primary)", background: "var(--bg-elevated)" }}
        >
          Today
        </button>
      )}
    </div>
  );
}
