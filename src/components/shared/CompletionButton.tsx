"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";

interface CompletionButtonProps {
  entity: "goal" | "space";
  isCompleted: boolean;
  isSaving: boolean;
  onClick: () => void;
  className?: string;
}

export function CompletionButton({
  entity,
  isCompleted,
  isSaving,
  onClick,
  className = "",
}: CompletionButtonProps) {
  const Icon = isCompleted ? RotateCcw : CheckCircle2;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className={`${className} flex items-center gap-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50`}
      style={{
        background: isCompleted ? "var(--bg-elevated)" : "var(--accent-positive)",
        color: isCompleted ? "var(--text-secondary)" : "var(--bg-base)",
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {isSaving ? "Saving..." : `${isCompleted ? "Reopen" : "Complete"} ${entity}`}
    </button>
  );
}
