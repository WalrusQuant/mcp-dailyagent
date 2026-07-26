"use client";

import { type LucideIcon } from "lucide-react";

interface Suggestion {
  label: string;
  data?: Record<string, unknown>;
}

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  suggestions?: Suggestion[];
  onSuggestionClick?: (suggestion: Suggestion) => void;
}

export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  suggestions,
  onSuggestionClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3.5 px-4">
      <div className="icon-badge w-12 h-12 rounded-2xl" style={{ width: "3rem", height: "3rem" }}>
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <p className="text-sm text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary mt-1">
          {actionLabel}
        </button>
      )}
      {suggestions && suggestions.length > 0 && onSuggestionClick && (
        <div className="flex flex-wrap justify-center gap-2 mt-1">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => onSuggestionClick(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
