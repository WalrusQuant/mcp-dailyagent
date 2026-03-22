"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Trash2,
  Loader2,
  MessageSquare,
  CheckSquare,
  Square,
  CheckCheck,
} from "lucide-react";
import type { Conversation } from "@/types/database";

const ITEMS_PER_PAGE = 30;

interface DateGroup {
  label: string;
  conversations: Conversation[];
}

function groupByDate(conversations: Conversation[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);
  const last30 = new Date(today.getTime() - 30 * 86400000);

  const groups: DateGroup[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "Previous 7 Days", conversations: [] },
    { label: "Previous 30 Days", conversations: [] },
    { label: "Older", conversations: [] },
  ];

  for (const conv of conversations) {
    const date = new Date(conv.updated_at);
    if (date >= today) groups[0].conversations.push(conv);
    else if (date >= yesterday) groups[1].conversations.push(conv);
    else if (date >= last7) groups[2].conversations.push(conv);
    else if (date >= last30) groups[3].conversations.push(conv);
    else groups[4].conversations.push(conv);
  }

  return groups.filter((g) => g.conversations.length > 0);
}

export function ChatHistory() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        const res = await fetch(
          `/api/conversations?page=${pageNum}&limit=${ITEMS_PER_PAGE}`
        );
        if (res.ok) {
          const data = await res.json();
          if (reset) setConversations(data);
          else setConversations((prev) => [...prev, ...data]);
          setHasMore(data.length === ITEMS_PER_PAGE);
          setPage(pageNum);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    loadConversations(0, true);
  }, [loadConversations]);

  // Search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.conversations || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoading &&
          !isLoadingMore &&
          !searchQuery
        ) {
          loadConversations(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, searchQuery, page, loadConversations]);

  const displayed = searchResults ?? conversations;
  const dateGroups = searchQuery
    ? [{ label: "Search Results", conversations: displayed }]
    : groupByDate(displayed);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;

    const ids = Array.from(selected);
    setIsDeleting(true);

    try {
      const res = await fetch("/api/conversations/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => !selected.has(c.id)));
        if (searchResults) {
          setSearchResults((prev) =>
            prev ? prev.filter((c) => !selected.has(c.id)) : null
          );
        }
        setSelected(new Set());
        setSelectMode(false);
        // Notify sidebar to refresh
        window.dispatchEvent(new Event("conversations-updated"));
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 md:px-6 py-3 space-y-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between">
          <h1
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Chat History
          </h1>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={selectAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    color: "var(--text-secondary)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {selected.size === displayed.length ? "Deselect all" : "Select all"}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selected.size === 0 || isDeleting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.1)",
                  }}
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
                <button
                  onClick={exitSelectMode}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--bg-elevated)",
                }}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Select
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-primary)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--border-default)")
            }
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: "var(--text-muted)" }}
            />
          </div>
        ) : isSearching ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: "var(--text-muted)" }}
            />
          </div>
        ) : displayed.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            {searchQuery ? "No results found" : "No conversations yet"}
          </p>
        ) : (
          <div className="space-y-4 py-3">
            {dateGroups.map((group) => (
              <div key={group.label}>
                <div
                  className="text-[10px] uppercase tracking-wider mb-2 px-1 font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.conversations.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conversation={conv}
                      selectMode={selectMode}
                      isSelected={selected.has(conv.id)}
                      onToggleSelect={() => toggleSelect(conv.id)}
                      onClick={() => router.push(`/chat/${conv.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {!searchQuery && (
              <div ref={loadMoreRef} className="py-4">
                {isLoadingMore && (
                  <div className="flex justify-center">
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  selectMode,
  isSelected,
  onToggleSelect,
  onClick,
}: {
  conversation: Conversation;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const date = new Date(conversation.updated_at);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
      style={{
        background: isSelected ? "var(--bg-elevated)" : undefined,
      }}
      onClick={selectMode ? onToggleSelect : onClick}
      onMouseEnter={(e) => {
        if (!isSelected)
          e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "";
      }}
    >
      {selectMode && (
        <div className="flex-shrink-0" style={{ color: isSelected ? "var(--accent-primary)" : "var(--text-muted)" }}>
          {isSelected ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </div>
      )}

      <MessageSquare
        className="w-4 h-4 flex-shrink-0"
        style={{ color: "var(--text-muted)" }}
      />

      <div className="flex-1 min-w-0">
        <div
          className="text-sm truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {conversation.title}
        </div>
        <div
          className="text-xs truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {conversation.model.split("/").pop()} &middot; {timeStr}
        </div>
      </div>

      {!selectMode && (
        <Link
          href={`/chat/${conversation.id}`}
          className="flex-shrink-0 text-xs px-2 py-1 rounded-md transition-colors"
          style={{
            color: "var(--accent-primary)",
            background: "var(--bg-elevated)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </Link>
      )}
    </div>
  );
}
