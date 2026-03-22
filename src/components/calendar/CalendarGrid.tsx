"use client";

import { getToday } from "@/lib/dates";
import { CalendarDayCell } from "./CalendarDayCell";
import type { DaySummary } from "./types";

interface CalendarGridProps {
  gridDates: string[];
  currentMonth: string;
  summaries: Record<string, DaySummary>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarGrid({
  gridDates,
  currentMonth,
  summaries,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const today = getToday();
  const weekCount = gridDates.length / 7;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Day-of-week header */}
      <div
        className="grid grid-cols-7 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] md:text-xs font-medium py-2 uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — each row is 1fr so they fill the space equally */}
      <div
        className="flex-1 grid grid-cols-7 min-h-0"
        style={{
          gridTemplateRows: `repeat(${weekCount}, 1fr)`,
        }}
      >
        {gridDates.map((date) => (
          <CalendarDayCell
            key={date}
            date={date}
            currentMonth={currentMonth}
            isToday={date === today}
            isSelected={date === selectedDate}
            summary={summaries[date]}
            onClick={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
