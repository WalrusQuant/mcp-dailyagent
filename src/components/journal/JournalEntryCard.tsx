"use client";

import { JournalEntry } from "@/types/database";
import { formatDate } from "@/lib/dates";

interface JournalEntryCardProps {
  entry: JournalEntry;
  onClick?: () => void;
}

const MOOD_LABELS = ["", "Bad", "Meh", "OK", "Good", "Great"];

export function JournalEntryCard({ entry, onClick }: JournalEntryCardProps) {
  const preview = entry.content.length > 150 ? entry.content.slice(0, 150) + "..." : entry.content;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-lg transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {formatDate(entry.entry_date, "long")}
        </span>
        {entry.mood && <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{MOOD_LABELS[entry.mood]}</span>}
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {preview}
      </p>
    </button>
  );
}
