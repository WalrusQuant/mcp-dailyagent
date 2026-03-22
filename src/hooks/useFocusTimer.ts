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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const completionHandledRef = useRef(false);

  // Load from localStorage on mount
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
  }, []);

  // Tick
  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, secondsLeft]);

  // Handle timer reaching 0
  useEffect(() => {
    if (secondsLeft === 0 && timerState && !completionHandledRef.current) {
      completionHandledRef.current = true;
      if (timerState.isBreak) {
        completeBreak();
      } else {
        completeWork();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, timerState]);

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

  const handleExpired = async (state: TimerState) => {
    if (!state.isBreak && state.sessionId) {
      try {
        await fetch(`/api/focus/${state.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      } catch {
        // ignore
      }
    }
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
  };

  const completeWork = async () => {
    if (!timerState) return;
    playNotification();

    if (timerState.sessionId) {
      try {
        await fetch(`/api/focus/${timerState.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
      } catch {
        // ignore
      }
    }

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
  };

  const completeBreak = () => {
    playNotification();
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
    completionHandledRef.current = false;
  };

  const start = async (workMinutes: number, breakMinutes: number, taskId: string | null, taskName: string | null) => {
    // Create session in DB
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
      // ignore
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
  };

  const pause = () => {
    if (!timerState) return;
    setIsRunning(false);
    const updated = { ...timerState, pausedAt: secondsLeft };
    storeState(updated);
    setTimerState(updated);
  };

  const resume = () => {
    if (!timerState || timerState.pausedAt === null) return;
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
  };

  const reset = async () => {
    if (timerState?.sessionId) {
      try {
        await fetch(`/api/focus/${timerState.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
      } catch {
        // ignore
      }
    }
    storeState(null);
    setTimerState(null);
    setSecondsLeft(0);
    setIsRunning(false);
    completionHandledRef.current = false;
  };

  const isActive = timerState !== null;
  const isBreak = timerState?.isBreak ?? false;
  const totalSeconds = timerState?.duration ?? 0;
  const isPaused = timerState?.pausedAt !== null;

  return {
    secondsLeft,
    totalSeconds,
    isActive,
    isRunning,
    isBreak,
    isPaused,
    taskName: timerState?.taskName ?? null,
    start,
    pause,
    resume,
    reset,
  };
}
