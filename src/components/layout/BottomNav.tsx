"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  LayoutDashboard,
  MoreHorizontal,
  X,
  FolderKanban,
  CalendarDays,
  Target,
  BookOpen,
  Dumbbell,
  Timer,
  FileText,
  Settings,
  Crosshair,
  Search,
} from "lucide-react";
import { useCommandPalette } from "@/lib/command-palette-context";
import { useAccessibleDialog } from "@/hooks/useAccessibleDialog";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home", match: "/dashboard" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks", match: "/tasks" },
];

const MORE_ITEMS = [
  { href: "/spaces", icon: FolderKanban, label: "Spaces" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/habits", icon: Target, label: "Habits" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/workouts", icon: Dumbbell, label: "Workouts" },
  { href: "/focus", icon: Timer, label: "Focus" },
  { href: "/goals", icon: Crosshair, label: "Goals" },
  { href: "/review", icon: FileText, label: "Review" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { toggle: toggleCommandPalette } = useCommandPalette();
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const closeMore = useCallback(() => setShowMore(false), []);
  const { dialogRef, titleId } = useAccessibleDialog(closeMore, showMore);

  // Detect keyboard open via visualViewport API
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  if (keyboardOpen) return null;

  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* More sheet overlay */}
      {showMore && (
        <div className="absolute inset-0 z-[70] md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(15, 17, 21, 0.55)", backdropFilter: "blur(2px)" }} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute left-0 right-0 rounded-t-[var(--radius-2xl)] p-4 pb-2"
            style={{
              bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-lg)",
              paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-1 rounded-full mx-auto mb-4"
              style={{ background: "var(--border-default)" }}
              aria-hidden
            />
            <div className="flex items-center justify-between mb-3 px-1">
              <span id={titleId} className="heading-sm">More</span>
              <button onClick={() => setShowMore(false)} className="btn-ghost p-1.5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                data-autofocus
                onClick={() => { setShowMore(false); toggleCommandPalette(); }}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-[var(--radius-lg)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <Search className="w-5 h-5" />
                <span className="text-xs font-medium">Search</span>
              </button>
              {MORE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-[var(--radius-lg)] transition-colors"
                    style={{
                      color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                      background: isActive ? "var(--accent-primary-soft)" : undefined,
                    }}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[60] md:hidden"
        style={{
          background: "color-mix(in srgb, var(--bg-surface) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-up)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          height: "calc(60px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-around h-[60px] px-2">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.match);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-1.5 px-5 min-w-[72px] rounded-[var(--radius-lg)] transition-colors"
                style={{
                  color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                  background: isActive ? "var(--accent-primary-soft)" : undefined,
                }}
              >
                <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            aria-haspopup="dialog"
            className="flex flex-col items-center gap-0.5 py-1.5 px-5 min-w-[72px] rounded-[var(--radius-lg)] transition-colors"
            style={{
              color: isMoreActive || showMore ? "var(--accent-primary)" : "var(--text-muted)",
              background: isMoreActive || showMore ? "var(--accent-primary-soft)" : undefined,
            }}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={isMoreActive || showMore ? 2.25 : 1.75} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>
    </>
  );
}
