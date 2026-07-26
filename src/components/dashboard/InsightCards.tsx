"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface InsightItem {
  emoji: string;
  title: string;
  body: string;
  type: "encouragement" | "warning" | "suggestion";
}

const DISMISSED_KEY = "dismissed-insights";

// Dismissal keys are scoped to the cache date + content so dismissing today's
// insight never hides a different one tomorrow (the old index-based keys did).
function insightKey(cacheDate: string, insight: InsightItem): string {
  return `${cacheDate}:${insight.title}:${insight.body}`;
}

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

export function InsightCards() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [cacheDate, setCacheDate] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/insights");
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          const items: InsightItem[] = data.insights ?? [];
          const date: string = data.cache_date ?? "";
          setInsights(items);
          setCacheDate(date);
          // Prune dismissals for insights no longer shown so storage can't
          // grow forever.
          const currentKeys = new Set(items.map((it) => insightKey(date, it)));
          const pruned = new Set([...getDismissed()].filter((k) => currentKeys.has(k)));
          setDismissed(pruned);
          saveDismissed(pruned);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = (key: string) => {
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  };

  if (isLoading || insights.length === 0) return null;

  const visible = insights
    .filter((insight) => !dismissed.has(insightKey(cacheDate, insight)))
    .slice(0, 3);

  if (visible.length === 0) return null;

  const typeStyles: Record<string, { bg: string; border: string }> = {
    encouragement: {
      bg: "color-mix(in srgb, var(--accent-positive) 10%, transparent)",
      border: "color-mix(in srgb, var(--accent-positive) 28%, transparent)",
    },
    warning: {
      bg: "color-mix(in srgb, var(--accent-warning) 10%, transparent)",
      border: "color-mix(in srgb, var(--accent-warning) 28%, transparent)",
    },
    suggestion: {
      bg: "color-mix(in srgb, var(--domain-focus) 12%, transparent)",
      border: "color-mix(in srgb, var(--domain-focus) 28%, transparent)",
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
      {visible.map((insight) => {
        const key = insightKey(cacheDate, insight);
        const styles = typeStyles[insight.type] || {
          bg: "var(--bg-surface)",
          border: "var(--border-default)",
        };
        return (
          <div
            key={key}
            className="rounded-[var(--radius-xl)] p-3.5 relative"
            style={{
              background: styles.bg,
              border: `1px solid ${styles.border}`,
            }}
          >
            <button
              onClick={() => handleDismiss(key)}
              className="btn-ghost absolute top-1.5 right-1.5 p-1"
              aria-label="Dismiss insight"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-start gap-2.5 pr-5">
              <span className="text-base leading-none mt-0.5" aria-hidden>
                {insight.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                  {insight.title}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {insight.body}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
