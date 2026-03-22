"use client";

import { useState } from "react";
import { CheckCircle2, Flame, Play } from "lucide-react";
import Link from "next/link";
import { Task } from "@/types/database";
import { useFocusTimerContext } from "@/lib/focus-timer-context";

interface DailyStartCardProps {
  tasks: { total: number; done: number; topPriorities: Task[] };
  habits: { total: number; completedToday: number; streak: number };
  focus: { todayMinutes: number; todaySessions: number };
}

export function DailyStartCard({ tasks, habits, focus }: DailyStartCardProps) {
  const timer = useFocusTimerContext();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("daily-start-dismissed") === "true"
  );
  const [taskDone, setTaskDone] = useState(false);

  const topTask = tasks.topPriorities.find((t) => !t.done) || null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("daily-start-dismissed", "true");
  };

  const handleCompleteTask = async () => {
    if (!topTask) return;
    try {
      const response = await fetch(`/api/tasks/${topTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (response.ok) {
        setTaskDone(true);
      }
    } catch {
      // ignore
    }
  };

  if (dismissed) {
    return (
      <button
        onClick={() => {
          setDismissed(false);
          sessionStorage.removeItem("daily-start-dismissed");
        }}
        className="text-xs mb-4 px-2 py-1 rounded transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
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
    <div
      className="mb-4 rounded-xl p-4"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderLeftWidth: "3px",
        borderLeftColor: "var(--accent-primary)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Daily Start
        </span>
        <button onClick={handleDismiss} className="text-xs" style={{ color: "var(--text-muted)" }}>
          Dismiss
        </button>
      </div>

      <div className="space-y-2.5">
        {/* Top task */}
        <div className="flex items-center gap-3">
          <CheckCircle2
            className="w-4 h-4 shrink-0"
            style={{ color: taskDone ? "var(--accent-positive)" : "var(--text-muted)" }}
          />
          {topTask && !taskDone ? (
            <button
              onClick={handleCompleteTask}
              className="flex-1 text-left text-sm transition-colors"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="text-xs font-medium mr-1.5 px-1 py-0.5 rounded"
                style={{ background: "var(--bg-elevated)", color: "var(--accent-primary)" }}
              >
                {topTask.priority}
              </span>
              {topTask.title}
            </button>
          ) : taskDone ? (
            <span className="text-sm line-through" style={{ color: "var(--text-muted)" }}>
              {topTask?.title || "Task completed"}
            </span>
          ) : (
            <Link href="/tasks" className="text-sm" style={{ color: "var(--accent-primary)" }}>
              Add a task
            </Link>
          )}
        </div>

        {/* Habit streak */}
        <div className="flex items-center gap-3">
          <Flame
            className="w-4 h-4 shrink-0"
            style={{ color: habits.streak > 0 ? "var(--accent-warning)" : "var(--text-muted)" }}
          />
          {habits.total > 0 ? (
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {habits.completedToday}/{habits.total} habits today
              {habits.streak > 0 && (
                <span className="ml-1.5 text-xs" style={{ color: "var(--accent-warning)" }}>
                  {habits.streak} day streak
                </span>
              )}
            </span>
          ) : (
            <Link href="/habits" className="text-sm" style={{ color: "var(--accent-primary)" }}>
              Start a habit
            </Link>
          )}
        </div>

        {/* Focus session */}
        <div className="flex items-center gap-3">
          <Play
            className="w-4 h-4 shrink-0"
            style={{ color: timer.isActive ? "var(--accent-positive)" : "var(--text-muted)" }}
          />
          {timer.isActive ? (
            <span className="text-sm" style={{ color: "var(--accent-positive)" }}>
              Focus: {formatTime(timer.secondsLeft)} remaining
            </span>
          ) : (
            <Link href="/focus" className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Start focus session
              {focus.todayMinutes > 0 && (
                <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  ({focus.todayMinutes}min today)
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
