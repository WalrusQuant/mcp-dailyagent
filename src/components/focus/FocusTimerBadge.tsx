"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { useFocusTimerContext } from "@/lib/focus-timer-context";

interface FocusTimerBadgeProps {
  collapsed?: boolean;
}

export function FocusTimerBadge({ collapsed }: FocusTimerBadgeProps) {
  const { isActive, isRunning, isBreak, secondsLeft } = useFocusTimerContext();

  if (!isActive) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const color = isBreak ? "#22c55e" : "var(--accent-primary)";

  return (
    <Link
      href="/focus"
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors mx-2 mb-1"
      style={{ background: "var(--bg-elevated)", border: `1px solid ${color}` }}
    >
      <Timer
        className="w-4 h-4 flex-shrink-0"
        style={{
          color,
          animation: isRunning ? "pulse 2s ease-in-out infinite" : undefined,
        }}
      />
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-xs font-medium" style={{ color }}>
            {isBreak ? "Break" : "Focus"}
          </span>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {timeStr}
          </span>
        </div>
      )}
    </Link>
  );
}
