"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText } from "lucide-react";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { startOfWeek, getToday } from "@/lib/dates";
import ReactMarkdown from "react-markdown";
import { StatCard } from "@/components/shared/StatCard";
import { ReviewSection } from "./ReviewSection";

export function WeeklyReview() {
  const [weekStart, setWeekStart] = useState(startOfWeek(getToday()));
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<{
    tasks?: { total: number; done: number };
    habits?: { total: number; completedToday: number; streak: number };
    focus?: { todayMinutes: number; todaySessions: number };
    workouts?: { weekCount: number };
  } | null>(null);

  const loadReview = useCallback(async (week: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/weekly-review?week=${week}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data && data.content ? data.content : "");
      } else {
        setContent("");
      }
    } catch {
      setContent("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReview(weekStart);
  }, [weekStart, loadReview]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDashboardStats)
      .catch(() => {});
  }, []);

  const handleDateChange = (date: string) => {
    setWeekStart(startOfWeek(date));
  };

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Weekly Review</h1>
        <DateNavigation date={weekStart} onDateChange={handleDateChange} mode="week" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : !content ? (
        <EmptyState
          icon={FileText}
          message="No review for this week yet. Weekly reviews are written by the OpenClaw agent."
        />
      ) : (
        <div>
          {dashboardStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <StatCard label="Tasks Done" value={`${dashboardStats.tasks?.done ?? 0}/${dashboardStats.tasks?.total ?? 0}`} />
              <StatCard label="Habit Streak" value={`${dashboardStats.habits?.streak ?? 0}d`} />
              <StatCard label="Focus" value={`${dashboardStats.focus?.todayMinutes ?? 0}m`} />
              <StatCard label="Workouts" value={dashboardStats.workouts?.weekCount ?? 0} />
            </div>
          )}

          {(() => {
            const sections = content.split(/^## /m).filter(Boolean);
            if (sections.length <= 1) {
              return (
                <div
                  className="prose prose-sm max-w-none rounded-lg p-6"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                >
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              );
            }
            const firstSection = content.startsWith("## ") ? null : sections[0];
            const headingSections = content.startsWith("## ") ? sections : sections.slice(1);
            return (
              <div className="space-y-2">
                {firstSection && (
                  <div
                    className="prose prose-sm max-w-none rounded-lg p-4"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  >
                    <ReactMarkdown>{firstSection.trim()}</ReactMarkdown>
                  </div>
                )}
                {headingSections.map((section, i) => {
                  const newlineIdx = section.indexOf("\n");
                  const title = newlineIdx > -1 ? section.slice(0, newlineIdx).trim() : section.trim();
                  const body = newlineIdx > -1 ? section.slice(newlineIdx + 1).trim() : "";
                  return (
                    <ReviewSection key={i} title={title} defaultExpanded={i < 3}>
                      <div className="prose prose-sm max-w-none" style={{ color: "var(--text-primary)" }}>
                        <ReactMarkdown>{body}</ReactMarkdown>
                      </div>
                    </ReviewSection>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
    </div>
  );
}
