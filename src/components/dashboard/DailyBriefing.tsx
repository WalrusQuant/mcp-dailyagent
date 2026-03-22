"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export function DailyBriefing() {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const router = useRouter();

  const loadBriefing = async () => {
    try {
      const res = await fetch("/api/briefing");
      if (res.ok) {
        const data = await res.json();
        if (data.disabled) {
          setDisabled(true);
          return;
        }
        setContent(data.content);
        setError(!data.content);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setError(!data.content);
      }
    } catch {
      // keep existing content
    } finally {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    loadBriefing();
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

  if (disabled) return null;
  if (error && !content) return null;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Daily Briefing
          </span>
        </div>
        <button
          onClick={regenerate}
          disabled={isRegenerating}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          title="Regenerate"
        >
          {isRegenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {content && (
        <div className="prose prose-sm max-w-none text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}

      <button
        onClick={() => router.push("/chat?prompt=Help%20me%20plan%20my%20day")}
        className="flex items-center gap-1.5 mt-3 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: "var(--accent-primary)" }}
      >
        Plan my day
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
