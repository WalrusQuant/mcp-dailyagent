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
  LayoutDashboard,
  CheckSquare,
  Target,
  BookOpen,
  Dumbbell,
  Timer,
  FileText,
  CalendarDays,
  Crosshair,
  Search,
} from "lucide-react";
import { FocusTimerBadge } from "@/components/focus/FocusTimerBadge";
import { CadenceMark } from "@/components/shared/CadenceMark";
import { useTheme } from "@/lib/theme";
import { useCommandPalette } from "@/lib/command-palette-context";

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
  const { toggle: toggleCommandPalette } = useCommandPalette();

  const handleSearchClick = () => {
    toggleCommandPalette();
    handleNavClick();
  };

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setUserDisplayName(data.display_name || null);
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

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(theme as "light" | "dark" | "system");
    setTheme(order[(idx + 1) % order.length]);
  };

  const themeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ThemeIcon = themeIcon;
  const initial = (userDisplayName || "C").charAt(0).toUpperCase();

  const isActive = (match: string) =>
    match === "/settings" ? pathname === "/settings" : pathname.startsWith(match);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(15, 17, 21, 0.55)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 flex flex-col h-full transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: collapsed ? "64px" : "260px",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className={collapsed ? "px-2 pt-4 pb-3" : "px-4 pt-5 pb-4"}
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "var(--accent-primary-soft)",
                  color: "var(--accent-primary)",
                  border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                }}
                aria-hidden
              >
                <CadenceMark size={18} />
              </div>
              <button
                onClick={onToggleCollapse}
                className="nav-item-icon"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--accent-primary-soft)",
                    color: "var(--accent-primary)",
                    border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                  }}
                  aria-hidden
                >
                  <CadenceMark size={18} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[15px] font-semibold tracking-tight leading-none truncate" style={{ color: "var(--text-primary)" }}>
                    Cadence
                  </h1>
                </div>
              </div>
              <button
                onClick={onToggleCollapse}
                className="nav-item-icon hidden md:flex shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={`${collapsed ? "p-2" : "px-3 py-3"} flex-1 overflow-y-auto`}>
          <FocusTimerBadge collapsed={collapsed} />

          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={handleSearchClick}
                className="nav-item-icon"
                title="Search (⌘K)"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className={isActive(link.match) ? "nav-item-icon nav-item-icon-active" : "nav-item-icon"}
                  title={link.label}
                >
                  <link.icon className="w-4 h-4" />
                </Link>
              ))}

              <div className="w-6 my-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

              {toolLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className={isActive(link.match) ? "nav-item-icon nav-item-icon-active" : "nav-item-icon"}
                  title={link.label}
                >
                  <link.icon className="w-4 h-4" />
                </Link>
              ))}

              <div className="w-6 my-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

              <Link
                href="/settings"
                onClick={handleNavClick}
                className={isActive("/settings") ? "nav-item-icon nav-item-icon-active" : "nav-item-icon"}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={handleSearchClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-lg)] text-sm transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left text-[13px]">Search</span>
                <kbd
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border-default)" }}
                >
                  ⌘K
                </kbd>
              </button>

              <div className="pt-2 space-y-0.5">
                {primaryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleNavClick}
                    className={isActive(link.match) ? "nav-item nav-item-active" : "nav-item"}
                  >
                    <link.icon className="w-4 h-4 shrink-0" />
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="pt-3 pb-1 px-3">
                <span className="overline">Tools</span>
              </div>

              <div className="space-y-0.5">
                {toolLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleNavClick}
                    className={isActive(link.match) ? "nav-item nav-item-active" : "nav-item"}
                  >
                    <link.icon className="w-4 h-4 shrink-0" />
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="my-2 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

              <Link
                href="/settings"
                onClick={handleNavClick}
                className={isActive("/settings") ? "nav-item nav-item-active" : "nav-item"}
              >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`${collapsed ? "p-2" : "px-3 py-3"} pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`}
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between gap-2"}`}>
            {!collapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: "var(--accent-primary-soft)",
                    color: "var(--accent-primary)",
                  }}
                >
                  {initial}
                </div>
                {userDisplayName && (
                  <span className="text-sm truncate max-w-[130px]" style={{ color: "var(--text-secondary)" }}>
                    {userDisplayName}
                  </span>
                )}
              </div>
            )}
            {collapsed && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{
                  background: "var(--accent-primary-soft)",
                  color: "var(--accent-primary)",
                }}
                title={userDisplayName || "You"}
              >
                {initial}
              </div>
            )}
            <button
              onClick={cycleTheme}
              className="nav-item-icon shrink-0"
              title={`Theme: ${theme}`}
              aria-label={`Theme: ${theme}. Click to cycle.`}
            >
              <ThemeIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
