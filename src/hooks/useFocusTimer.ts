"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TimerState {
  startTime: number;
  duration: number; // total seconds
  breakDuration: number;
  taskId: string | null;
  taskName: string | null;
  sessionId: string | null;
  isBreak: boolean;
  pausedAt: number | null; // seconds remaining when paused
}

const STORAGE_KEY = "focus-timer-state";

function getStoredState(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeState(state: TimerState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useFocusTimer() {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  // Incremented each time a work session naturally completes (not on cancel/reset).
  // Consumers can watch this to show a "session complete" toast.
  const [workSessionCompletedCount, setWorkSessionCompletedCount] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const completionHandledRef = useRef(false);

  const updateSession = useCallback(async (sessionId: string, body: Record<string, unknown>) => {
    setMutationError(null);
    try {
      const response = await fetch(`/api/focus/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Focus session update failed");
      return true;
    } catch {
      setMutationError("Couldn’t update the focus session. Your timer was left unchanged; try again.");
      return false;
    }
  }, []);

  const playNotification = useCallback(() => {
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // ignore audio errors
    }
  }, []);

  // Reliable completion signal for a backgrounded tab: a system notification
  // (Web Audio is throttled when hidden and the in-app toast isn't visible),
  // plus a title flash that restores when the tab is next focused.
  const notifyCompletion = useCallback((title: string, body: string) => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch {
      // ignore notification errors
    }
    if (typeof document !== "undefined" && document.hidden) {
      const original = document.title;
      document.title = `⏰ ${title}`;
      const restore = () => {
        document.title = original;
        document.removeEventListener("visibilitychange", restore);
      };
      document.addEventListener("visibilitychange", restore);
    }
  }, []);

  const handleExpired = useCallback(async (state: TimerState) => {
    if (!state.isBreak && state.sessionId) {
      if (!(await updateSession(state.sessionId, { status: "completed" }))) {
        const pausedState = { ...state, pausedAt: 0 };
        storeState(pausedState);
        setTimerState(pausedState);
        setSecondsLeft(0);
        setIsRunning(false);
        // Keep automatic completion latched after a failed request. The user
        // can explicitly retry once connectivity returns; clearing this here
        // would create a tight PATCH retry loop.
        completionHandledRef.current = true;
        return;
      }
    }
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
  }, [updateSession]);

  // Load from localStorage on mount. Runs once (empty deps) — handleExpired is
  // a stable useCallback with no component-state capture, so omitting it is safe.
  useEffect(() => {
    const stored = getStoredState();
    if (!stored) return;

    if (stored.pausedAt !== null) {
      // Was paused
      setTimerState(stored);
      setSecondsLeft(stored.pausedAt);
      setIsRunning(false);
    } else {
      // Was running — calculate remaining time
      const elapsed = Math.floor((Date.now() - stored.startTime) / 1000);
      const remaining = stored.duration - elapsed;

      if (remaining <= 0) {
        // Timer expired while away — handle completion
        handleExpired(stored);
      } else {
        setTimerState(stored);
        setSecondsLeft(remaining);
        setIsRunning(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick — remaining time is always recomputed from the persisted wall-clock
  // startTime, so throttled/suspended background tabs can't drift or stall the
  // countdown; visibilitychange resyncs immediately when the tab wakes up.
  useEffect(() => {
    if (!isRunning || !timerState || timerState.pausedAt !== null) return;

    const sync = () => {
      const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
      const remaining = Math.max(0, timerState.duration - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) setIsRunning(false);
    };

    sync();
    const interval = setInterval(sync, 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isRunning, timerState]);

  const completeWork = useCallback(async () => {
    if (!timerState) return;
    if (timerState.sessionId) {
      if (!(await updateSession(timerState.sessionId, { status: "completed" }))) {
        // Leave the zero-time session available for an explicit user retry,
        // but do not let the completion effect immediately call the API again.
        completionHandledRef.current = true;
        return false;
      }
    }

    playNotification();
    notifyCompletion("Focus session complete", "Nice work — time for a break.");

    setWorkSessionCompletedCount((n) => n + 1);

    // Start break
    const breakState: TimerState = {
      startTime: Date.now(),
      duration: timerState.breakDuration,
      breakDuration: timerState.breakDuration,
      taskId: timerState.taskId,
      taskName: timerState.taskName,
      sessionId: null,
      isBreak: true,
      pausedAt: null,
    };
    storeState(breakState);
    setTimerState(breakState);
    setSecondsLeft(timerState.breakDuration);
    completionHandledRef.current = false;
    setIsRunning(true);
    return true;
  }, [timerState, playNotification, notifyCompletion, updateSession]);

  const completeBreak = useCallback(() => {
    playNotification();
    notifyCompletion("Break over", "Ready for the next focus session?");
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
    completionHandledRef.current = false;
  }, [playNotification, notifyCompletion]);

  // Handle timer reaching 0. State writes are deferred via queueMicrotask so they
  // don't fire inside the effect's render phase (React 19 set-state-in-effect rule).
  useEffect(() => {
    if (secondsLeft !== 0 || !timerState || completionHandledRef.current) return;
    completionHandledRef.current = true;
    const isBreak = timerState.isBreak;
    queueMicrotask(() => {
      if (isBreak) completeBreak();
      else completeWork();
    });
  }, [secondsLeft, timerState, completeBreak, completeWork]);

  const start = async (workMinutes: number, breakMinutes: number, taskId: string | null, taskName: string | null) => {
    // Ask for notification permission at a natural moment — the user just chose
    // to start a focus session — so completion can alert a backgrounded tab.
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore
    }

    // Create session in DB — do not run a timer without a server record
    let sessionId: string | null = null;
    try {
      const response = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId || null,
          duration_minutes: workMinutes,
          break_minutes: breakMinutes,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        sessionId = data.id;
      }
    } catch {
      // fall through to failure path
    }

    if (!sessionId) {
      return false;
    }

    const state: TimerState = {
      startTime: Date.now(),
      duration: workMinutes * 60,
      breakDuration: breakMinutes * 60,
      taskId,
      taskName,
      sessionId,
      isBreak: false,
      pausedAt: null,
    };
    storeState(state);
    setTimerState(state);
    setSecondsLeft(workMinutes * 60);
    completionHandledRef.current = false;
    setIsRunning(true);
    return true;
  };

  const pause = async () => {
    if (!timerState) return false;
    if (timerState.sessionId && !timerState.isBreak) {
      if (!(await updateSession(timerState.sessionId, { status: "paused" }))) return false;
    }
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    const pausedAt = timerState.isBreak
      ? Math.max(0, timerState.duration - elapsed)
      : Math.min(secondsLeft, Math.max(0, timerState.duration - elapsed));
    const updated = { ...timerState, pausedAt };
    storeState(updated);
    setTimerState(updated);
    setIsRunning(false);
    return true;
  };

  const resume = async () => {
    if (!timerState || timerState.pausedAt === null) return false;
    if (timerState.sessionId && !timerState.isBreak) {
      if (!(await updateSession(timerState.sessionId, { status: "active" }))) return false;
    }
    const updated: TimerState = {
      ...timerState,
      startTime: Date.now(),
      duration: timerState.pausedAt,
      pausedAt: null,
    };
    storeState(updated);
    setTimerState(updated);
    completionHandledRef.current = false;
    setIsRunning(true);
    return true;
  };

  const reset = async () => {
    if (timerState?.sessionId) {
      if (!(await updateSession(timerState.sessionId, { status: "cancelled" }))) return false;
    }
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
    completionHandledRef.current = false;
    return true;
  };

  /** Mark the current work session complete early (not cancel). */
  const completeEarly = async (notes?: string) => {
    if (!timerState || timerState.isBreak) return false;
    if (timerState.sessionId) {
      if (!(await updateSession(timerState.sessionId, {
        status: "completed",
        ...(notes ? { notes } : {}),
      }))) return false;
    }
    setWorkSessionCompletedCount((n) => n + 1);
    const breakState: TimerState = {
      startTime: Date.now(),
      duration: timerState.breakDuration,
      breakDuration: timerState.breakDuration,
      taskId: timerState.taskId,
      taskName: timerState.taskName,
      sessionId: null,
      isBreak: true,
      pausedAt: null,
    };
    storeState(breakState);
    setTimerState(breakState);
    setSecondsLeft(timerState.breakDuration);
    completionHandledRef.current = false;
    setIsRunning(true);
    return true;
  };

  const isActive = timerState !== null;
  const isBreak = timerState?.isBreak ?? false;
  const totalSeconds = timerState?.duration ?? 0;
  const isPaused = timerState !== null && timerState.pausedAt !== null;

  return {
    secondsLeft,
    totalSeconds,
    isActive,
    isRunning,
    isBreak,
    isPaused,
    workSessionCompletedCount,
    mutationError,
    clearMutationError: () => setMutationError(null),
    taskName: timerState?.taskName ?? null,
    sessionId: timerState?.sessionId ?? null,
    start,
    pause,
    resume,
    reset,
    completeEarly,
  };
}
