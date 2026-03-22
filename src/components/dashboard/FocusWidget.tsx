"use client";

import Link from "next/link";
import { Timer } from "lucide-react";

interface FocusWidgetProps {
  todayMinutes: number;
  todaySessions: number;
}

export function FocusWidget({ todayMinutes, todaySessions }: FocusWidgetProps) {
  return (
    <Link
      href="/focus"
      className="block rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-primary)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-default)"}
    >
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4" style={{ color: "#3b82f6" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Focus</span>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {todayMinutes}m
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>focus time</div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {todaySessions}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>sessions</div>
        </div>
      </div>
    </Link>
  );
}
