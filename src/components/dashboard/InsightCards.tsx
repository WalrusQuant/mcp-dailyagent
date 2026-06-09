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

  const typeBg: Record<string, string> = {
    encouragement: "rgba(74, 222, 128, 0.08)",
    warning: "rgba(251, 191, 36, 0.08)",
    suggestion: "rgba(96, 165, 250, 0.08)",
  };

  const typeBorder: Record<string, string> = {
    encouragement: "rgba(74, 222, 128, 0.2)",
    warning: "rgba(251, 191, 36, 0.2)",
    suggestion: "rgba(96, 165, 250, 0.2)",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      {visible.map((insight) => {
        const key = insightKey(cacheDate, insight);
        return (
          <div
            key={key}
            className="rounded-xl p-3 relative"
            style={{
              background: typeBg[insight.type] || "var(--bg-surface)",
              border: `1px solid ${typeBorder[insight.type] || "var(--border-default)"}`,
            }}
          >
            <button
              onClick={() => handleDismiss(key)}
              className="absolute top-2 right-2 p-1 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-start gap-2">
              <span className="text-lg">{insight.emoji}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {insight.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
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
