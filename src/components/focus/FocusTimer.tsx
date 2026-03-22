"use client";

import { useState, useEffect, useCallback } from "react";
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

  // Reload sessions when timer completes (isActive goes from true to false)
  const [wasActive, setWasActive] = useState(timer.isActive);
  useEffect(() => {
    if (wasActive && !timer.isActive) {
      loadData();
      addToast("Focus session complete!");
    }
    setWasActive(timer.isActive);
  }, [timer.isActive, wasActive, loadData, addToast]);

  const handleStart = () => {
    const task = tasks.find((t) => t.id === selectedTaskId);
    timer.start(workMinutes, breakMinutes, selectedTaskId || null, task?.title || null);
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
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
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
      <div className="flex items-center justify-center gap-3 mt-6">
        {timer.isActive ? (
          <>
            {timer.isRunning ? (
              <button
                onClick={timer.pause}
                className="p-3 rounded-full transition-opacity hover:opacity-90"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
              >
                <Pause className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={timer.resume}
                className="p-3 rounded-full transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
              >
                <Play className="w-6 h-6" />
              </button>
            )}
            <button
              onClick={timer.reset}
              className="p-3 rounded-full transition-opacity hover:opacity-90"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            className="p-3 rounded-full transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
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

      {/* Task selector — only when not active */}
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
              <option key={t.id} value={t.id}>{t.priority} — {t.title}</option>
            ))}
          </select>
        </div>
      )}

      <FocusStats refreshKey={todaySessions.length} />
    </div>
    </div>
  );
}
