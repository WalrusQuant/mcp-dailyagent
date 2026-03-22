"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  CheckSquare,
  Target,
  BookOpen,
  Dumbbell,
  Timer,
  FileText,
  Settings,
  Plus,
  Search,
} from "lucide-react";
import { useCommandPalette } from "@/lib/command-palette-context";

interface Command {
  id: string;
  label: string;
  category: string;
  icon?: React.ReactNode;
  keywords?: string[];
  shortcut?: string;
  handler: () => void;
}

function fuzzyScore(query: string, text: string, keywords: string[] = []): number {
  if (!query) return 1;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searchTarget = [text, ...keywords].join(" ").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (searchTarget.includes(token)) {
      score += token.length;
      // Bonus for label match
      if (text.toLowerCase().includes(token)) score += token.length;
      // Bonus for start of label
      if (text.toLowerCase().startsWith(token)) score += token.length * 2;
    } else {
      // If any token doesn't match at all, return 0
      return 0;
    }
  }
  return score;
}

const ICON_SIZE = "w-4 h-4";

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      close();
    },
    [router, close]
  );

  const allCommands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      {
        id: "new-task",
        label: "New Task",
        category: "Actions",
        icon: <Plus className={ICON_SIZE} />,
        keywords: ["create", "add", "todo"],
        handler: () => navigate("/tasks"),
      },
      {
        id: "new-journal",
        label: "New Journal Entry",
        category: "Actions",
        icon: <Plus className={ICON_SIZE} />,
        keywords: ["create", "write", "diary", "note"],
        handler: () => navigate("/journal"),
      },
    ];

    const navigation: Command[] = [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        category: "Navigation",
        icon: <LayoutDashboard className={ICON_SIZE} />,
        keywords: ["home", "overview", "summary"],
        handler: () => navigate("/dashboard"),
      },
      {
        id: "nav-projects",
        label: "Projects",
        category: "Navigation",
        icon: <FolderKanban className={ICON_SIZE} />,
        keywords: ["folder", "organize"],
        handler: () => navigate("/projects"),
      },
      {
        id: "nav-tasks",
        label: "Tasks",
        category: "Navigation",
        icon: <CheckSquare className={ICON_SIZE} />,
        keywords: ["todo", "checklist", "priorities", "franklin covey"],
        handler: () => navigate("/tasks"),
      },
      {
        id: "nav-habits",
        label: "Habits",
        category: "Navigation",
        icon: <Target className={ICON_SIZE} />,
        keywords: ["tracker", "routine", "streak", "daily"],
        handler: () => navigate("/habits"),
      },
      {
        id: "nav-journal",
        label: "Journal",
        category: "Navigation",
        icon: <BookOpen className={ICON_SIZE} />,
        keywords: ["diary", "writing", "mood", "reflection"],
        handler: () => navigate("/journal"),
      },
      {
        id: "nav-workouts",
        label: "Workouts",
        category: "Navigation",
        icon: <Dumbbell className={ICON_SIZE} />,
        keywords: ["exercise", "fitness", "gym", "training"],
        handler: () => navigate("/workouts"),
      },
      {
        id: "nav-focus",
        label: "Focus Timer",
        category: "Navigation",
        icon: <Timer className={ICON_SIZE} />,
        keywords: ["pomodoro", "concentration", "work", "productivity"],
        handler: () => navigate("/focus"),
      },
      {
        id: "nav-review",
        label: "Weekly Review",
        category: "Navigation",
        icon: <FileText className={ICON_SIZE} />,
        keywords: ["summary", "reflection", "weekly", "report"],
        handler: () => navigate("/review"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        category: "Navigation",
        icon: <Settings className={ICON_SIZE} />,
        keywords: ["preferences", "account", "config", "profile"],
        handler: () => navigate("/settings"),
      },
    ];

    return [...actions, ...navigation];
  }, [navigate]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    return allCommands
      .map((cmd) => ({ cmd, score: fuzzyScore(query, cmd.label, cmd.keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }, [query, allCommands]);

  // Group results by category, preserving order of first appearance
  const grouped = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!map[cmd.category]) {
        map[cmd.category] = [];
        order.push(cmd.category);
      }
      map[cmd.category].push(cmd);
    }
    return order.map((cat) => ({ category: cat, commands: map[cat] }));
  }, [filteredCommands]);

  // Flat list for arrow key nav
  const flatList = useMemo(
    () => grouped.flatMap((g) => g.commands),
    [grouped]
  );

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset activeIndex when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(flatList.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(flatList.length, 1)) % Math.max(flatList.length, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flatList[activeIndex];
        if (cmd) cmd.handler();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [flatList, activeIndex, close]
  );

  if (!isOpen) return null;

  // Build a flat index map for rendering
  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          maxHeight: "60vh",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands and pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd
            className="hidden sm:flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              fontFamily: "inherit",
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {grouped.length === 0 ? (
            <div
              className="px-4 py-8 text-sm text-center"
              style={{ color: "var(--text-muted)" }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            grouped.map(({ category, commands }) => (
              <div key={category}>
                <div
                  className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider sticky top-0"
                  style={{
                    color: "var(--text-muted)",
                    background: "var(--bg-surface)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {category}
                </div>
                {commands.map((cmd) => {
                  const itemIndex = globalIndex++;
                  const isActive = itemIndex === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-active={isActive}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                      style={{
                        background: isActive ? "var(--bg-hover)" : "transparent",
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      onClick={() => cmd.handler()}
                    >
                      <span
                        className="flex-shrink-0"
                        style={{
                          color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                        }}
                      >
                        {cmd.icon}
                      </span>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd
                          className="hidden sm:flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            color: "var(--text-muted)",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            fontFamily: "inherit",
                          }}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-xs"
          style={{
            borderTop: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                fontFamily: "inherit",
              }}
            >
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                fontFamily: "inherit",
              }}
            >
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                fontFamily: "inherit",
              }}
            >
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
