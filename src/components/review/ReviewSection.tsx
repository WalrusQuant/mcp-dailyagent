"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ReviewSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ReviewSection({ title, children, defaultExpanded = true }: ReviewSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border-default)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
        style={{ background: "var(--bg-surface)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        )}
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4" style={{ background: "var(--bg-surface)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
