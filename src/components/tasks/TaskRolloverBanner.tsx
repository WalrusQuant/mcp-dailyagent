"use client";

import { useState } from "react";
import { RotateCcw, X, Loader2 } from "lucide-react";

interface TaskRolloverBannerProps {
  count: number;
  onRollover: () => Promise<void>;
  onDismiss: () => void;
}

export function TaskRolloverBanner({ count, onRollover, onDismiss }: TaskRolloverBannerProps) {
  const [isRolling, setIsRolling] = useState(false);

  const handleRollover = async () => {
    setIsRolling(true);
    try {
      await onRollover();
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent-primary)" }} />
      <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
        {count} incomplete {count === 1 ? "task" : "tasks"} from previous days
      </span>
      <button
        onClick={handleRollover}
        disabled={isRolling}
        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
        style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
      >
        {isRolling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Roll Over"}
      </button>
      <button onClick={onDismiss} className="p-1" style={{ color: "var(--text-muted)" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
