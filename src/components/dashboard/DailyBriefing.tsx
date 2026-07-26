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
      <div className="card mb-5 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-4 w-28 rounded" style={{ background: "var(--bg-elevated)" }} />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-3 w-4/5 rounded" style={{ background: "var(--bg-elevated)" }} />
          <div className="h-3 w-3/5 rounded" style={{ background: "var(--bg-elevated)" }} />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="card-quiet mb-5 flex items-start gap-2.5">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        <p className="caption leading-relaxed" style={{ color: "var(--text-muted)" }}>
          No briefing yet — your OpenClaw agent posts the morning briefing here once it runs.
        </p>
      </div>
    );
  }

  return (
    <div className="card mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="icon-badge" style={{ width: "1.5rem", height: "1.5rem" }}>
          <Sparkles className="w-3 h-3" />
        </span>
        <span className="heading-sm">Daily Briefing</span>
      </div>

      <div
        className="prose prose-sm max-w-none leading-relaxed"
        style={{
          color: "var(--text-secondary)",
          fontFamily: "var(--font-display), var(--font-sans), serif",
          fontSize: "0.9375rem",
          lineHeight: 1.7,
        }}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
