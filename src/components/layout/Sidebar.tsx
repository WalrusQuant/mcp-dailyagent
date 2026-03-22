"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  MessageSquare,
  Image as ImageIcon,
  Trash2,
  LogOut,
  Loader2,
  X,
  Search,
  Check,
  Pencil,
  Sun,
  Moon,
  Monitor,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  FolderKanban,
  Wrench,
  LayoutDashboard,
  CheckSquare,
  Target,
  BookOpen,
  Dumbbell,
  Timer,
  FileText,
  CalendarDays,
  Crosshair,
  Shield,
} from "lucide-react";
import { Conversation } from "@/types/database";
import { UsageBalance } from "@/components/UsageBalance";
import { FocusTimerBadge } from "@/components/focus/FocusTimerBadge";
import { useTheme } from "@/lib/theme";
import { useModels } from "@/lib/useModels";
import { SearchModal } from "@/components/search/SearchModal";
import { ConversationListSkeleton } from "@/components/shared/Skeleton";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ITEMS_PER_PAGE = 20;

interface DateGroup {
  label: string;
  conversations: Conversation[];
}

function groupConversationsByDate(conversations: Conversation[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7Days = new Date(today.getTime() - 7 * 86400000);
  const last30Days = new Date(today.getTime() - 30 * 86400000);

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
    else if (date >= last7Days) groups[2].conversations.push(conv);
    else if (date >= last30Days) groups[3].conversations.push(conv);
    else groups[4].conversations.push(conv);
  }

  return groups.filter((g) => g.conversations.length > 0);
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme } = useTheme();
  const { isAdmin } = useModels();

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.conversations || []);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setUserDisplayName(profile?.display_name || user.email || null);
    }
  }, [supabase]);

  const loadConversations = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const response = await fetch(
        `/api/conversations?page=${pageNum}&limit=${ITEMS_PER_PAGE}`
      );
      if (response.ok) {
        const data = await response.json();
        if (reset) setConversations(data);
        else setConversations((prev) => [...prev, ...data]);
        setHasMore(data.length === ITEMS_PER_PAGE);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadConversations(page + 1, false);
    }
  }, [isLoadingMore, hasMore, page, loadConversations]);

  useEffect(() => {
    loadConversations(0, true);
    loadUser();

    const handleRefresh = () => loadConversations(0, true);
    window.addEventListener("conversations-updated", handleRefresh);

    const handleTitleUpdate = (e: Event) => {
      const { id, title } = (e as CustomEvent).detail;
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    };
    window.addEventListener("conversation-title-updated", handleTitleUpdate);

    const handleFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener("focus-sidebar-search", handleFocusSearch);

    const handleGlobalSearch = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalSearch);

    return () => {
      window.removeEventListener("conversations-updated", handleRefresh);
      window.removeEventListener("conversation-title-updated", handleTitleUpdate);
      window.removeEventListener("focus-sidebar-search", handleFocusSearch);
      window.removeEventListener("keydown", handleGlobalSearch);
    };
  }, [loadConversations, loadUser]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore && !searchQuery) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, searchQuery, loadMore]);

  const handleNewChat = () => {
    router.push("/chat");
    if (window.innerWidth < 768) onClose();
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (pathname === `/chat/${id}`) {
          router.push("/chat");
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const startEditing = (conversation: Conversation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) {
      cancelEditing();
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (response.ok) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, title: editTitle.trim() } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to update title:", error);
    } finally {
      cancelEditing();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(id);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleNavClick = () => {
    if (window.innerWidth < 768) onClose();
  };

  const primaryLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", match: "/dashboard" },
    { href: "/chat", icon: MessageSquare, label: "Chat", match: "/chat" },
    { href: "/image", icon: ImageIcon, label: "Images", match: "/image" },
  ];

  const toolLinks = [
    { href: "/projects", icon: FolderKanban, label: "Projects", match: "/projects" },
    { href: "/calendar", icon: CalendarDays, label: "Calendar", match: "/calendar" },
    { href: "/tasks", icon: CheckSquare, label: "Tasks", match: "/tasks" },
    { href: "/habits", icon: Target, label: "Habits", match: "/habits" },
    { href: "/workouts", icon: Dumbbell, label: "Workouts", match: "/workouts" },
    { href: "/focus", icon: Timer, label: "Focus", match: "/focus" },
    { href: "/goals", icon: Crosshair, label: "Goals", match: "/goals" },
    { href: "/journal", icon: BookOpen, label: "Journal", match: "/journal" },
    { href: "/review", icon: FileText, label: "Review", match: "/review" },
  ];

  const secondaryLinks: typeof primaryLinks = [];

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(theme as "light" | "dark" | "system");
    setTheme(order[(idx + 1) % order.length]);
  };

  const themeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ThemeIcon = themeIcon;

  const displayedConversations = searchResults ?? conversations;
  const dateGroups = searchQuery
    ? [{ label: "Search Results", conversations: displayedConversations }]
    : groupConversationsByDate(displayedConversations);

  const renderConversation = (conversation: Conversation) => {
    if (editingId === conversation.id) {
      return (
        <div
          key={conversation.id}
          className="flex items-center gap-1 px-2 py-2 rounded-lg"
          style={{ background: "var(--bg-elevated)" }}
        >
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => handleEditKeyDown(e, conversation.id)}
            onBlur={() => saveTitle(conversation.id)}
            className="flex-1 text-sm px-2 py-1 rounded focus:outline-none"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--accent-primary)",
            }}
          />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              saveTitle(conversation.id);
            }}
            className="p-1 rounded"
            style={{ color: "var(--accent-positive)" }}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              cancelEditing();
            }}
            className="p-1 rounded"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    const isActive = pathname === `/chat/${conversation.id}`;

    return (
      <Link
        key={conversation.id}
        href={`/chat/${conversation.id}`}
        onClick={handleNavClick}
        className="group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
          background: isActive ? "var(--bg-elevated)" : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "";
        }}
      >
        <MessageSquare className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate text-xs">{conversation.title}</span>
        <div data-touch-action="sidebar" className="hidden group-hover:flex items-center gap-0 shrink-0">
          <button
            onClick={(e) => startEditing(conversation, e)}
            className="p-1 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => deleteConversation(conversation.id, e)}
            className="p-1 transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 flex flex-col h-full transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: collapsed ? "60px" : "280px",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        {/* Header: collapse toggle + new chat + close */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
          {collapsed ? (
            <div className="flex flex-col items-center w-full gap-1">
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <button
                onClick={handleNewChat}
                className="p-2 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="relative flex-1 ml-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none transition-colors"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg transition-colors hidden md:block"
                style={{ color: "var(--text-secondary)" }}
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 md:hidden"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className={`${collapsed ? "p-2" : "px-3 py-2"}`}>
          {/* Focus Timer Badge — shown when active */}
          <FocusTimerBadge collapsed={collapsed} />

          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    color: pathname.startsWith(link.match) ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                  title={link.label}
                >
                  <link.icon className="w-4 h-4" />
                </Link>
              ))}

              <div className="w-6 my-1" style={{ borderTop: "1px solid var(--border-default)" }} />

              <div className="relative group/tools">
                <button
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    color: [...toolLinks, ...secondaryLinks].some((l) => pathname.startsWith(l.match))
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  }}
                  title="Tools"
                >
                  <Wrench className="w-4 h-4" />
                </button>
                <div
                  className="absolute left-full top-0 ml-1 hidden group-hover/tools:block rounded-lg py-1 z-50 min-w-[140px]"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                >
                  {[...toolLinks, ...secondaryLinks].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={handleNavClick}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                      style={{
                        color: pathname.startsWith(link.match) ? "var(--accent-primary)" : "var(--text-secondary)",
                      }}
                    >
                      <link.icon className="w-3.5 h-3.5" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href="/settings"
                onClick={handleNavClick}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: pathname === "/settings" ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={handleNavClick}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    color: pathname === "/admin" ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                  title="Admin"
                >
                  <Shield className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    color: pathname.startsWith(link.match) ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}

              <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-default)" }} />

              {toolLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    color: pathname.startsWith(link.match) ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}

              <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-default)" }} />

              <Link
                href="/settings"
                onClick={handleNavClick}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  color: pathname === "/settings" ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={handleNavClick}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    color: pathname === "/admin" ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div
          className={`flex-1 overflow-y-auto ${collapsed ? "px-1" : "px-3"}`}
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          {collapsed ? (
            <div className="space-y-1 flex flex-col items-center pt-2">
              {conversations.slice(0, 10).map((conv) => {
                const isActive = pathname === `/chat/${conv.id}`;
                return (
                  <Link
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    onClick={handleNavClick}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                      background: isActive ? "var(--bg-elevated)" : undefined,
                    }}
                    title={conv.title}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                );
              })}
            </div>
          ) : isLoading ? (
            <ConversationListSkeleton />
          ) : isSearching ? (
            <div className="flex justify-center py-8">
              <Loader2
                className="w-5 h-5 animate-spin"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          ) : displayedConversations.length === 0 ? (
            <p className="text-xs px-2 pt-3" style={{ color: "var(--text-muted)" }}>
              {searchQuery ? "No results found" : "No conversations yet"}
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {dateGroups.map((group) => (
                <div key={group.label}>
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1 px-2 font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.conversations.map(renderConversation)}
                  </div>
                </div>
              ))}

              {/* Load more trigger */}
              {!searchQuery && (
                <div ref={loadMoreRef} className="py-2">
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

        {/* Footer */}
        <div className={`${collapsed ? "p-2" : "p-4"} space-y-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`} style={{ borderTop: "1px solid var(--border-default)" }}>
          {!collapsed && <UsageBalance />}
          <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
            {!collapsed && (
              <span
                className="text-sm truncate max-w-[150px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {userDisplayName}
              </span>
            )}
            <div className={`flex items-center ${collapsed ? "flex-col" : ""} gap-1`}>
              <button
                onClick={cycleTheme}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                title={`Theme: ${theme}`}
              >
                <ThemeIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </>
  );
}
