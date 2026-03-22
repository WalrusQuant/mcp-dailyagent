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
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Icon className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          {actionLabel}
        </button>
      )}
      {suggestions && suggestions.length > 0 && onSuggestionClick && (
        <div className="flex flex-wrap justify-center gap-2 mt-1">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => onSuggestionClick(s)}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
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
