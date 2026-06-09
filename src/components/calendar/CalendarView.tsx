"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getToday, addMonths, formatMonth } from "@/lib/dates";
import { CalendarGrid } from "./CalendarGrid";
import { DayDetailPanel } from "./DayDetailPanel";
import type { DaySummary, DayDetail } from "./types";

export function CalendarView() {
  const today = getToday();
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7));
  const [gridDates, setGridDates] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    // Abort on month change/unmount so a slow response can't render a stale month.
    const controller = new AbortController();
    const fetchMonth = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/calendar?month=${currentMonth}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setSummaries(data.summaries);
          setGridDates(data.gridDates);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch calendar data:", err);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchMonth();
    return () => controller.abort();
  }, [currentMonth]);

  // Click-driven (not effect-driven), so guard with a request counter: only
  // the latest selected day's response may write state.
  const detailRequestRef = useRef(0);
  const fetchDayDetail = useCallback(async (date: string) => {
    const requestId = ++detailRequestRef.current;
    setIsDetailLoading(true);
    setDayDetail(null);
    try {
      const res = await fetch(`/api/calendar/day?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        if (detailRequestRef.current === requestId) setDayDetail(data);
      }
    } catch (err) {
      console.error("Failed to fetch day detail:", err);
    } finally {
      if (detailRequestRef.current === requestId) setIsDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    detailRequestRef.current++; // invalidate any in-flight detail fetch
    setSelectedDate(null);
    setDayDetail(null);
    setIsDetailLoading(false);
  }, []);

  const handleSelectDate = (date: string) => {
    if (selectedDate === date) {
      closeDetail();
    } else {
      setSelectedDate(date);
      fetchDayDetail(date);
    }
  };

  const goToPrev = () => {
    closeDetail();
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goToNext = () => {
    closeDetail();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    closeDetail();
    setCurrentMonth(today.slice(0, 7));
  };

  const isCurrentMonth = currentMonth === today.slice(0, 7);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrev}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2
            className="text-base md:text-lg font-semibold min-w-[150px] text-center"
            style={{ color: "var(--text-primary)" }}
          >
            {formatMonth(currentMonth)}
          </h2>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1.5 rounded-full transition-colors font-medium"
            style={{
              color: "var(--accent-primary)",
              background: "var(--bg-elevated)",
            }}
          >
            Today
          </button>
        )}
      </div>

      {/* Grid fills remaining space */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : gridDates.length > 0 ? (
        <CalendarGrid
          gridDates={gridDates}
          currentMonth={currentMonth}
          summaries={summaries}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No data available
          </p>
        </div>
      )}

      {/* Day Detail */}
      {(selectedDate || isDetailLoading) && (
        <DayDetailPanel
          detail={dayDetail}
          isLoading={isDetailLoading}
          onClose={closeDetail}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
