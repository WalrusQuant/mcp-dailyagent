"use client";

interface TimerDisplayProps {
  seconds: number;
  totalSeconds: number;
  isRunning: boolean;
  isBreak: boolean;
}

export function TimerDisplay({ seconds, totalSeconds, isRunning, isBreak }: TimerDisplayProps) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = totalSeconds > 0 ? 1 - seconds / totalSeconds : 0;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  const color = isBreak ? "#22c55e" : "var(--accent-primary)";

  return (
    <div className="relative w-44 h-44 md:w-56 md:h-56 mx-auto">
      <svg viewBox="0 0 224 224" className="w-full h-full transform -rotate-90">
        <circle
          cx="112"
          cy="112"
          r="90"
          fill="none"
          strokeWidth="6"
          style={{ stroke: "var(--border-default)" }}
        />
        <circle
          cx="112"
          cy="112"
          r="90"
          fill="none"
          strokeWidth="6"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-mono font-bold tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {isBreak ? "Break" : isRunning ? "Focus" : "Ready"}
        </span>
      </div>
    </div>
  );
}
