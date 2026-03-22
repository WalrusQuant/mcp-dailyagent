"use client";

import { useState, useEffect } from "react";
import { Timer, Target } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";

interface DailyBreakdown {
  date: string;
  sessions: number;
  minutes: number;
}

interface TopTask {
  taskTitle: string;
  sessions: number;
}

interface FocusStatsData {
  totalSessions: number;
  totalMinutes: number;
  dailyBreakdown: DailyBreakdown[];
  topTasks: TopTask[];
}

interface FocusStatsProps {
  refreshKey: number;
}

function DailyBarChart({ data }: { data: DailyBreakdown[] }) {
  const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);
  const barWidth = 100 / data.length;
  const chartHeight = 60;
  const dayLabels = data.map((d) => {
    const date = new Date(d.date + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
  });

  return (
    <div>
      <svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = (d.minutes / maxMinutes) * (chartHeight - 16);
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          return (
            <rect
              key={d.date}
              x={x}
              y={chartHeight - 16 - barH}
              width={w}
              height={Math.max(barH, d.minutes > 0 ? 2 : 0)}
              rx={1.5}
              fill={d.minutes > 0 ? "var(--accent-primary)" : "var(--bg-elevated)"}
              opacity={d.minutes > 0 ? 0.85 : 0.4}
            />
          );
        })}
      </svg>
      <div className="flex justify-between px-0.5">
        {dayLabels.map((label, i) => (
          <span key={i} className="text-[10px]" style={{ color: "var(--text-muted)", width: `${barWidth}%`, textAlign: "center" }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FocusStats({ refreshKey }: FocusStatsProps) {
  const [stats, setStats] = useState<FocusStatsData | null>(null);

  useEffect(() => {
    fetch("/api/focus/stats?days=7")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [refreshKey]);

  if (!stats) return null;

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        This Week
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Sessions" value={stats.totalSessions} icon={Target} />
        <StatCard label="Focus Time" value={`${stats.totalMinutes}m`} icon={Timer} />
      </div>

      {stats.dailyBreakdown.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Daily Focus
          </h3>
          <DailyBarChart data={stats.dailyBreakdown} />
        </div>
      )}

      {stats.topTasks.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Top Tasks
          </h3>
          <div className="space-y-1.5">
            {stats.topTasks.slice(0, 3).map((t) => (
              <div key={t.taskTitle} className="flex items-center justify-between text-sm">
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{t.taskTitle}</span>
                <span className="flex-shrink-0 ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t.sessions} {t.sessions === 1 ? "session" : "sessions"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
