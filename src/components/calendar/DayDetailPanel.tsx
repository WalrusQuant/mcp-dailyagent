"use client";

import Link from "next/link";
import {
  CheckSquare,
  Target,
  BookOpen,
  Dumbbell,
  Timer,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { DayDetail } from "./types";

interface DayDetailPanelProps {
  detail: DayDetail | null;
  isLoading: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];

const PRIORITY_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#22c55e",
};

export function DayDetailPanel({ detail, isLoading, onClose, isMobile }: DayDetailPanelProps) {
  if (!detail && !isLoading) return null;

  const content = (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {detail ? formatDate(detail.date, "long") : "Loading..."}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : detail ? (
        <>
          {/* Tasks */}
          {detail.tasks.length > 0 && (
            <Section
              icon={<CheckSquare className="w-4 h-4" />}
              label="Tasks"
              color="var(--text-primary)"
              linkHref={`/tasks?date=${detail.date}`}
            >
              <div className="space-y-1">
                {detail.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PRIORITY_COLORS[t.priority] ?? "var(--text-muted)" }}
                    />
                    <span
                      style={{
                        color: t.done ? "var(--text-muted)" : "var(--text-primary)",
                        textDecoration: t.done ? "line-through" : undefined,
                      }}
                    >
                      {t.title}
                    </span>
                    {t.done && (
                      <span className="text-xs" style={{ color: "var(--accent-positive)" }}>
                        Done
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Habits */}
          {detail.habits.length > 0 && (
            <Section
              icon={<Target className="w-4 h-4" />}
              label="Habits"
              color="var(--text-primary)"
              linkHref={`/habits?date=${detail.date}`}
            >
              <div className="space-y-1">
                {detail.habits.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: h.color }}
                    />
                    <span style={{ color: "var(--text-primary)" }}>{h.name}</span>
                    {h.completed && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: "var(--accent-positive-bg, rgba(34,197,94,0.1))",
                          color: "var(--accent-positive)",
                        }}
                      >
                        Done
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Journal */}
          {detail.journal && (
            <Section
              icon={<BookOpen className="w-4 h-4" />}
              label="Journal"
              color="var(--accent-primary)"
              linkHref={`/journal?date=${detail.date}`}
            >
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {detail.journal.mood && (
                  <span className="mr-2">{MOOD_EMOJI[detail.journal.mood]}</span>
                )}
                <span className="line-clamp-2">
                  {detail.journal.content.replace(/[#*_~`>]/g, "").slice(0, 150)}
                  {detail.journal.content.length > 150 ? "..." : ""}
                </span>
              </div>
            </Section>
          )}

          {/* Workouts */}
          {detail.workouts.length > 0 && (
            <Section
              icon={<Dumbbell className="w-4 h-4" />}
              label="Workouts"
              color="#8b5cf6"
              linkHref={`/workouts?date=${detail.date}`}
            >
              <div className="space-y-1">
                {detail.workouts.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{w.name}</span>
                    {w.duration_minutes && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {w.duration_minutes}min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Focus */}
          {detail.focus.length > 0 && (
            <Section
              icon={<Timer className="w-4 h-4" />}
              label="Focus Sessions"
              color="#3b82f6"
              linkHref={`/focus?date=${detail.date}`}
            >
              <div className="space-y-1">
                {detail.focus.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{f.duration_minutes}min</span>
                    {f.task_title && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {f.task_title}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Empty state */}
          {detail.tasks.length === 0 &&
            detail.habits.length === 0 &&
            !detail.journal &&
            detail.workouts.length === 0 &&
            detail.focus.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                No activity on this day
              </p>
            )}
        </>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-[70]" onClick={onClose} />
        <div
          className="fixed left-0 right-0 z-[70] rounded-t-2xl p-4 overflow-y-auto"
          style={{
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
            maxHeight: "calc(100vh - 120px - env(safe-area-inset-bottom, 0px))",
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border-default)",
          }}
        >
          {content}
        </div>
      </>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl p-4"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      {content}
    </div>
  );
}

function Section({
  icon,
  label,
  color,
  linkHref,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  linkHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color }}>
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <Link
          href={linkHref}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: "var(--accent-primary)" }}
        >
          View
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}
