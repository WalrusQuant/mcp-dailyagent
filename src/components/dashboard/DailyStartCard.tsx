"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Circle, Flame, Play, X } from "lucide-react";
import Link from "next/link";
import { Task, Habit } from "@/types/database";
import { useFocusTimerContext } from "@/lib/focus-timer-context";
import { useToast } from "@/lib/toast-context";
import { getToday } from "@/lib/dates";

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
  const [habitList, setHabitList] = useState<Habit[] | null>(null);
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());

  // Lazy-load habits on first render via event, not setState-in-effect.
  // Triggered once when the card mounts by rendering a bootstrap callback.
  const habitsLoaded = habitList !== null;

  const ensureHabitsLoaded = useCallback(async () => {
    if (habitList !== null) return;
    try {
      const [habitsRes, statsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch("/api/habits/stats?days=7"),
      ]);
      let list: Habit[] = [];
      if (habitsRes.ok) list = await habitsRes.json();
      setHabitList(list);
      if (statsRes.ok) {
        const data = await statsRes.json();
        const logged = new Set<string>();
        const today = getToday();
        for (const h of data.habits ?? []) {
          if ((h.recentLogs as string[] | undefined)?.includes(today)) {
            logged.add(h.id);
          }
        }
        setLoggedToday(logged);
      }
    } catch {
      setHabitList([]);
    }
  }, [habitList]);

  // Fire once after paint without useEffect setState-on-mount lint
  useEffect(() => {
    void ensureHabitsLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  const topTask = tasks.topPriorities.find((t) => !t.done) || null;
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

  const handleToggleHabit = async (habitId: string) => {
    const today = getToday();
    const wasLogged = loggedToday.has(habitId);
    setLoggedToday((prev) => {
      const next = new Set(prev);
      if (wasLogged) next.delete(habitId);
      else next.add(habitId);
      return next;
    });
    try {
      const response = await fetch(`/api/habits/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      if (response.ok) {
        const { logged } = await response.json();
        setLoggedToday((prev) => {
          const next = new Set(prev);
          if (logged) next.add(habitId);
          else next.delete(habitId);
          return next;
        });
        onTaskComplete?.(); // refresh dashboard counts
      } else {
        setLoggedToday((prev) => {
          const next = new Set(prev);
          if (wasLogged) next.add(habitId);
          else next.delete(habitId);
          return next;
        });
        addToast("Failed to update habit");
      }
    } catch {
      setLoggedToday((prev) => {
        const next = new Set(prev);
        if (wasLogged) next.add(habitId);
        else next.delete(habitId);
        return next;
      });
      addToast("Failed to update habit");
    }
  };

  if (dismissed) {
    return (
      <button
        onClick={() => {
          setDismissed(false);
          sessionStorage.removeItem("daily-start-dismissed");
        }}
        className="btn-ghost mb-4 text-xs"
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

  const list = habitList ?? [];
  const pendingHabits = list.filter((h) => !loggedToday.has(h.id)).slice(0, 5);

  return (
    <div className="card-hero mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="overline" style={{ color: "var(--accent-primary)" }}>
            Today
          </span>
          <h2 className="heading-md mt-0.5">Daily Start</h2>
        </div>
        <button onClick={handleDismiss} className="btn-ghost p-1.5" aria-label="Dismiss daily start">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Top task */}
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
            <button onClick={handleCompleteTask} className="flex-1 text-left min-w-0">
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

        {/* Habit check-offs */}
        {list.length > 0 ? (
          <div className="px-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Flame
                className="w-4 h-4 shrink-0"
                style={{ color: habits.streak > 0 ? "var(--accent-warning)" : "var(--text-muted)" }}
              />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {loggedToday.size}/{list.length} habits
                {habits.streak > 0 && (
                  <span className="ml-1.5" style={{ color: "var(--accent-warning)" }}>
                    · {habits.streak}d streak
                  </span>
                )}
              </span>
            </div>
            {pendingHabits.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-6">
                {pendingHabits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleToggleHabit(h.id)}
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: `1px solid ${h.color}`,
                    }}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
            {pendingHabits.length === 0 && habitsLoaded && (
              <p className="text-xs pl-6" style={{ color: "var(--accent-positive)" }}>
                All habits done for today
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-1">
            <Flame className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            {habitsLoaded ? (
              <Link href="/habits" className="text-[13px]" style={{ color: "var(--accent-primary)" }}>
                Start a habit
              </Link>
            ) : (
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                {habits.total > 0
                  ? `${habits.completedToday}/${habits.total} habits today`
                  : "Loading habits…"}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <Play
            className="w-4 h-4 shrink-0"
            style={{ color: timer.isActive ? "var(--accent-positive)" : "var(--text-muted)" }}
          />
          {timer.isActive ? (
            <span
              className="text-[13px] font-medium tabular-nums"
              style={{ color: "var(--accent-positive)" }}
            >
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
