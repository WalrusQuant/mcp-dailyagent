"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogOut,
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
  const [isAdmin, setIsAdmin] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const { theme, setTheme } = useTheme();

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, is_admin")
        .eq("id", user.id)
        .single();
      setUserDisplayName(profile?.display_name || user.email || null);
      setIsAdmin(profile?.is_admin === true);
    }
  }, [supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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
        {/* Header: collapse toggle */}
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
            </div>
          ) : (
            <>
              <div className="flex-1" />
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg transition-colors hidden md:block"
                style={{ color: "var(--text-secondary)" }}
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
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

        {/* Footer */}
        <div className={`${collapsed ? "p-2" : "p-4"} space-y-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`} style={{ borderTop: "1px solid var(--border-default)" }}>
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
    </>
  );
}
