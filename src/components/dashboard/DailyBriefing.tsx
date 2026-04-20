"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function DailyBriefing() {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/briefing");
        if (res.ok) {
          const data = await res.json();
          setContent(data.content ?? null);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 mb-4 animate-pulse"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 w-32 rounded" style={{ background: "var(--bg-elevated)" }} />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-3 w-4/5 rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-3 w-3/5 rounded" style={{ background: "var(--bg-elevated)" }} />
        </div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Daily Briefing
        </span>
      </div>

      <div className="prose prose-sm max-w-none text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
