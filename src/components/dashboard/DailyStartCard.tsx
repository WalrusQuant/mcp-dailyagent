"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Flame, Play, X } from "lucide-react";
import Link from "next/link";
import { Task } from "@/types/database";
import { useFocusTimerContext } from "@/lib/focus-timer-context";
import { useToast } from "@/lib/toast-context";

interface DailyStartCardProps {
  tasks: { total: number; done: number; topPriorities: Task[] };
  habits: { total: number; completedToday: number; streak: number };
  focus: { todayMinutes: number; todaySessions: number };
  onTaskComplete?: () => void;
}

export function DailyStartCard({ tasks, habits, focus, onTaskComplete }: DailyStartCardProps) {
  const timer = useFocusTimerContext();
  const { addToast } = useToast();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("daily-start-dismissed") === "true"
  );
  const [completedId, setCompletedId] = useState<string | null>(null);

  const topTask = tasks.topPriorities.find((t) => !t.done) || null;
  // Derived, not effect-synced: strike through only while the just-completed
  // task is still the top task. Once a reload refreshes props it drops off the
  // undone list and the card advances to the next task on its own.
  const showDone = !!topTask && topTask.id === completedId;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("daily-start-dismissed", "true");
  };

  const handleCompleteTask = async () => {
    if (!topTask) return;
    setCompletedId(topTask.id);
    try {
      const response = await fetch(`/api/tasks/${topTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (response.ok) {
        addToast("Task completed");
        onTaskComplete?.();
      } else {
        setCompletedId(null);
        addToast("Failed to complete task");
      }
    } catch {
      setCompletedId(null);
      addToast("Failed to complete task");
    }
  };

  if (dismissed) {
    return (
      <button onClick={() => {
        setDismissed(false);
        sessionStorage.removeItem("daily-start-dismissed");
      }} className="btn-ghost mb-4 text-xs">
        Show daily start
      </button>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="card-hero mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="overline" style={{ color: "var(--accent-primary)" }}>Today</span>
          <h2 className="heading-md mt-0.5">Daily Start</h2>
        </div>
        <button onClick={handleDismiss} className="btn-ghost p-1.5" aria-label="Dismiss daily start">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Top task — primary action */}
        <div
          className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5"
          style={{ background: "var(--bg-elevated)" }}
        >
          {topTask && !showDone ? (
            <button
              onClick={handleCompleteTask}
              className="shrink-0 rounded-full transition-colors"
              style={{ color: "var(--text-muted)" }}
              aria-label={`Complete task: ${topTask.title}`}
            >
              <Circle className="w-5 h-5" strokeWidth={1.75} />
            </button>
          ) : (
            <CheckCircle2
              className="w-5 h-5 shrink-0"
              style={{ color: showDone ? "var(--accent-positive)" : "var(--text-muted)" }}
            />
          )}
          {topTask && !showDone ? (
            <button
              onClick={handleCompleteTask}
              className="flex-1 text-left min-w-0"
            >
              <span
                className="text-[11px] font-semibold mr-2 px-1.5 py-0.5 rounded"
                style={{ background: "var(--accent-primary-soft)", color: "var(--accent-primary)" }}
              >
                {topTask.priority}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {topTask.title}
              </span>
            </button>
          ) : showDone ? (
            <span className="text-sm line-through" style={{ color: "var(--text-muted)" }}>
              {topTask?.title || "Task completed"}
            </span>
          ) : (
            <Link href="/tasks" className="text-sm font-medium" style={{ color: "var(--accent-primary)" }}>
              Add a task for today
            </Link>
          )}
        </div>

        {/* Secondary rows */}
        <div className="flex items-center gap-3 px-1">
          <Flame
            className="w-4 h-4 shrink-0"
            style={{ color: habits.streak > 0 ? "var(--accent-warning)" : "var(--text-muted)" }}
          />
          {habits.total > 0 ? (
            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {habits.completedToday}/{habits.total} habits today
              {habits.streak > 0 && (
                <span className="ml-1.5" style={{ color: "var(--accent-warning)" }}>
                  · {habits.streak}d streak
                </span>
              )}
            </span>
          ) : (
            <Link href="/habits" className="text-[13px]" style={{ color: "var(--accent-primary)" }}>
              Start a habit
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <Play
            className="w-4 h-4 shrink-0"
            style={{ color: timer.isActive ? "var(--accent-positive)" : "var(--text-muted)" }}
          />
          {timer.isActive ? (
            <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--accent-positive)" }}>
              Focus · {formatTime(timer.secondsLeft)} remaining
            </span>
          ) : (
            <Link href="/focus" className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Start focus session
              {focus.todayMinutes > 0 && (
                <span className="ml-1.5" style={{ color: "var(--text-muted)" }}>
                  ({focus.todayMinutes}m today)
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
