"use client";

import { BookOpen } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";

interface JournalWidgetProps {
  hasEntry: boolean;
  mood: number | null;
}

const MOOD_LABELS = ["", "Bad", "Meh", "OK", "Good", "Great"];

export function JournalWidget({ hasEntry, mood }: JournalWidgetProps) {
  return (
    <WidgetCard
      href="/journal"
      title="Journal"
      icon={BookOpen}
      domainColor="var(--domain-journal)"
    >
      {hasEntry ? (
        <div className="flex items-center gap-2">
          {mood != null && mood > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-[var(--radius-md)] font-medium"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              {MOOD_LABELS[mood]}
            </span>
          )}
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Entry written today
          </span>
        </div>
      ) : (
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Write today&apos;s entry →
        </span>
      )}
    </WidgetCard>
  );
}
