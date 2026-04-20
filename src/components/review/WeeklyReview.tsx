"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, FileText } from "lucide-react";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { startOfWeek, getToday } from "@/lib/dates";
import ReactMarkdown from "react-markdown";
import { StatCard } from "@/components/shared/StatCard";
import { ReviewSection } from "./ReviewSection";

export function WeeklyReview() {
  const [weekStart, setWeekStart] = useState(startOfWeek(getToday()));
  const [content, setContent] = useState("");
  const [, setReviewId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
        if (data && data.content) {
          setContent(data.content);
          setReviewId(data.id);
        } else {
          setContent("");
          setReviewId(null);
        }
      } else {
        setContent("");
        setReviewId(null);
      }
    } catch {
      setContent("");
      setReviewId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReview(weekStart);
    setIsEditing(false);
  }, [weekStart, loadReview]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDashboardStats)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, content }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviewId(data.id);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to save review:", error);
    } finally {
      setIsSaving(false);
    }
  };

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
      ) : !content && !isEditing ? (
        <EmptyState
          icon={FileText}
          message="No review for this week yet"
          actionLabel="Write one"
          onAction={() => setIsEditing(true)}
        />
      ) : isEditing ? (
        <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none resize-none min-h-[200px] md:min-h-[400px] font-mono"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              lineHeight: "1.6",
            }}
            placeholder="Write your weekly review..."
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setIsEditing(false); loadReview(weekStart); }}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
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

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
