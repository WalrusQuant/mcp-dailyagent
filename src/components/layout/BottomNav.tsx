"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", match: "/dashboard" },
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
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detect keyboard open via visualViewport API
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // If viewport height is significantly smaller than window height, keyboard is open
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
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 right-0 rounded-t-2xl p-4 pb-2"
            style={{
              bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--border-default)",
              paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>More</span>
              <button onClick={() => setShowMore(false)} style={{ color: "var(--text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-1 py-3 rounded-lg transition-colors"
                    style={{
                      color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                      background: isActive ? "var(--bg-elevated)" : undefined,
                    }}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-xs">{item.label}</span>
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
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-default)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          height: "calc(60px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-around h-[60px]">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.match);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-2 px-4"
                style={{ color: isActive ? "var(--accent-primary)" : "var(--text-muted)" }}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex flex-col items-center gap-0.5 py-2 px-4"
            style={{ color: isMoreActive ? "var(--accent-primary)" : "var(--text-muted)" }}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </div>
    </>
  );
}
