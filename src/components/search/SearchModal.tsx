"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, MessageSquare, SlidersHorizontal } from "lucide-react";
import { SearchResult } from "./SearchResult";
import { useModels } from "@/lib/useModels";
import { Conversation } from "@/types/database";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MessageMatch {
  id: string;
  conversationId: string;
  conversationTitle: string;
  snippet: string;
  role: string;
  createdAt: string;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageMatches, setMessageMatches] = useState<MessageMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [model, setModel] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { chatModels } = useModels();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setConversations([]);
      setMessageMatches([]);
      setShowFilters(false);
      setDateFrom("");
      setDateTo("");
      setModel("");
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setConversations([]);
      setMessageMatches([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q, advanced: "true" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (model) params.set("model", model);

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setMessageMatches(data.messageMatches || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, [dateFrom, dateTo, model]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setConversations([]);
      setMessageMatches([]);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(() => doSearch(query), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, doSearch]);

  const navigateTo = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasResults = conversations.length > 0 || messageMatches.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-xl shadow-2xl flex flex-col max-h-[70vh]"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all messages..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {isSearching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: showFilters ? "var(--accent-primary)" : "var(--text-muted)" }}
            title="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <option value="">All models</option>
                {chatModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {(dateFrom || dateTo || model) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setModel(""); }}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: "var(--accent-primary)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasQuery ? (
            <div className="text-center py-8">
              <Search className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Search across all your conversations and messages
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Tip: Use Cmd+Shift+F to open this search anytime
              </p>
            </div>
          ) : !isSearching && !hasResults ? (
            <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
              No results found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              {/* Conversation matches */}
              {conversations.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                    Conversations ({conversations.length})
                  </h3>
                  <div className="space-y-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => navigateTo(conv.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent-primary)" }} />
                        <span className="text-sm truncate">{conv.title}</span>
                        <span className="ml-auto text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {new Date(conv.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message matches */}
              {messageMatches.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                    Messages ({messageMatches.length})
                  </h3>
                  <div className="space-y-2">
                    {messageMatches.map((match) => (
                      <SearchResult
                        key={match.id}
                        conversationId={match.conversationId}
                        conversationTitle={match.conversationTitle}
                        snippet={match.snippet}
                        role={match.role}
                        createdAt={match.createdAt}
                        onClick={navigateTo}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 text-xs flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border-default)", color: "var(--text-muted)" }}
        >
          <span>Full-text search across all messages</span>
          <kbd
            className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}
          >
            ESC
          </kbd>
        </div>
      </div>
    </div>
  );
}
