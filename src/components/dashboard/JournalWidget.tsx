"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

interface JournalWidgetProps {
  hasEntry: boolean;
  mood: number | null;
}

const MOOD_LABELS = ["", "Bad", "Meh", "OK", "Good", "Great"];

export function JournalWidget({ hasEntry, mood }: JournalWidgetProps) {
  return (
    <Link
      href="/journal"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: "#8b5cf6" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Journal</span>
      </div>

      {hasEntry ? (
        <div className="flex items-center gap-2">
          {mood && <span className="text-sm px-2.5 py-1 rounded-md font-medium" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{MOOD_LABELS[mood]}</span>}
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Entry written today
          </span>
        </div>
      ) : (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Write today&apos;s entry →
        </div>
      )}
    </Link>
  );
}
