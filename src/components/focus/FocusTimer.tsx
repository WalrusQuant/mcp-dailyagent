"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/shared/Skeleton";
import { Task, FocusSession } from "@/types/database";
import { TimerDisplay } from "./TimerDisplay";
import { FocusStats } from "./FocusStats";
import { getToday } from "@/lib/dates";
import { useFocusTimerContext } from "@/lib/focus-timer-context";
import { useToast } from "@/lib/toast-context";

export function FocusTimer() {
  const timer = useFocusTimerContext();
  const { addToast } = useToast();
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [todaySessions, setTodaySessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = getToday();
      const [tasksRes, sessionsRes] = await Promise.all([
        fetch(`/api/tasks?date=${today}`),
        fetch(`/api/focus?from=${today}&to=${today}`),
      ]);

      if (tasksRes.ok) {
        const data: Task[] = await tasksRes.json();
        setTasks(data.filter((t) => !t.done));
      }
      if (sessionsRes.ok) {
        setTodaySessions(await sessionsRes.json());
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload sessions and toast only on natural work-session completion, not on
  // cancel or reset. workSessionCompletedCount increments in completeWork().
  const prevCompletedRef = useRef(timer.workSessionCompletedCount);
  useEffect(() => {
    if (timer.workSessionCompletedCount !== prevCompletedRef.current) {
      prevCompletedRef.current = timer.workSessionCompletedCount;
      loadData();
      addToast("Focus session complete!");
    }
  }, [timer.workSessionCompletedCount, loadData, addToast]);

  const handleStart = async () => {
    const task = tasks.find((t) => t.id === selectedTaskId);
    const ok = await timer.start(
      workMinutes,
      breakMinutes,
      selectedTaskId || null,
      task?.title || null
    );
    if (!ok) {
      addToast("Couldn't start focus session — try again");
    }
  };

  const displaySeconds = timer.isActive ? timer.secondsLeft : workMinutes * 60;
  const displayTotal = timer.isActive ? timer.totalSeconds : workMinutes * 60;

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6 flex flex-col items-center">
        <Skeleton width="160px" height="24px" className="mb-6" />
        <Skeleton variant="circle" width="200px" height="200px" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <h1 className="text-xl font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>
        Focus Timer
      </h1>

      <TimerDisplay
        seconds={displaySeconds}
        totalSeconds={displayTotal}
        isRunning={timer.isRunning}
        isBreak={timer.isBreak}
      />

      {/* Task name when active */}
      {timer.isActive && timer.taskName && (
        <p className="text-center text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          {timer.taskName}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
        {timer.isActive ? (
          <>
            {timer.isRunning ? (
              <button
                onClick={timer.pause}
                className="p-3 rounded-full transition-opacity hover:opacity-90"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                aria-label="Pause"
              >
                <Pause className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={timer.resume}
                className="p-3 rounded-full transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                aria-label="Resume"
              >
                <Play className="w-6 h-6" />
              </button>
            )}
            {!timer.isBreak && (
              <button
                onClick={async () => {
                  await timer.completeEarly();
                  loadData();
                  addToast("Session completed — break started");
                }}
                className="px-3 py-2 rounded-full text-xs font-medium"
                style={{ background: "var(--accent-primary-soft)", color: "var(--accent-primary)" }}
              >
                Complete early
              </button>
            )}
            <button
              onClick={async () => {
                await timer.reset();
                loadData();
              }}
              className="p-3 rounded-full transition-opacity hover:opacity-90"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              aria-label="Cancel"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            className="p-3 rounded-full transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            aria-label="Start"
          >
            <Play className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Duration settings — only when not active */}
      {!timer.isActive && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Work:</label>
            <select
              value={workMinutes}
              onChange={(e) => setWorkMinutes(Number(e.target.value))}
              className="rounded px-2 py-1 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              {[15, 20, 25, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>Break:</label>
            <select
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
              className="rounded px-2 py-1 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              {[3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Task selector — only when not active (includes overdue open tasks via today API) */}
      {!timer.isActive && tasks.length > 0 && (
        <div className="mt-4">
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          >
            <option value="">No task linked</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.priority} — {t.title}
                {t.task_date !== getToday() ? ` (${t.task_date})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Today&apos;s sessions
          </h2>
          <ul className="space-y-1.5">
            {todaySessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                <span style={{ color: "var(--text-primary)" }}>
                  {s.duration_minutes}m
                  <span className="ml-2 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                    {s.status}
                  </span>
                </span>
                {s.notes && (
                  <span className="text-xs truncate max-w-[50%]" style={{ color: "var(--text-secondary)" }}>
                    {s.notes}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FocusStats refreshKey={todaySessions.length} />
    </div>
    </div>
  );
}
