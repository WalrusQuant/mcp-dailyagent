"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
} from "lucide-react";
import { FocusTimerBadge } from "@/components/focus/FocusTimerBadge";
import { useTheme } from "@/lib/theme";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setUserDisplayName(data.displayName || null);
      } catch {
        // non-fatal — sidebar works without a display name
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  const handleNavClick = () => {
    if (window.innerWidth < 768) onClose();
  };

  const primaryLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", match: "/dashboard" },
  ];

  const toolLinks = [
    { href: "/calendar", icon: CalendarDays, label: "Calendar", match: "/calendar" },
    { href: "/spaces", icon: FolderKanban, label: "Spaces", match: "/spaces" },
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
        {/* Header */}
        <div className={collapsed ? "px-2 pt-3 pb-2" : "px-3 pt-4 pb-3"} style={{ borderBottom: "1px solid var(--border-default)" }}>
          {collapsed ? (
            <div className="flex flex-col items-center">
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="pl-[calc(16px+0.5rem)]">
                <h1 className="text-base font-bold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
                  Daily Agent MCP
                </h1>
                <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--accent-primary)" }}>
                  Productivity
                </p>
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg transition-colors hidden md:block"
                style={{ color: "var(--text-secondary)" }}
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={`${collapsed ? "p-2" : "px-3 py-2"} flex-1 overflow-y-auto`}>
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`${collapsed ? "p-2" : "p-4"} space-y-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`} style={{ borderTop: "1px solid var(--border-default)" }}>
          <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
            {!collapsed && userDisplayName && (
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
