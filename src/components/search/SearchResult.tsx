"use client";

import { MessageSquare, User, Bot } from "lucide-react";

interface SearchResultProps {
  conversationId: string;
  conversationTitle: string;
  snippet: string;
  role: string;
  createdAt: string;
  onClick: (conversationId: string) => void;
}

function sanitizeSnippet(html: string): string {
  // Only allow <mark> tags
  return html.replace(/<(?!\/?mark>)[^>]+>/g, "");
}

export function SearchResult({
  conversationId,
  conversationTitle,
  snippet,
  role,
  createdAt,
  onClick,
}: SearchResultProps) {
  const date = new Date(createdAt);
  const RoleIcon = role === "assistant" ? Bot : User;

  return (
    <button
      onClick={() => onClick(conversationId)}
      className="w-full text-left rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
    >
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--accent-primary)" }} />
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {conversationTitle}
        </span>
        <span className="ml-auto text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <RoleIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        <p
          className="text-xs leading-relaxed line-clamp-3"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: sanitizeSnippet(snippet) }}
        />
      </div>
    </button>
  );
}
