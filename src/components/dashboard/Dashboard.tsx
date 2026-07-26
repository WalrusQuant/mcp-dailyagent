"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardSkeleton } from "@/components/shared/Skeleton";
import { TaskWidget } from "./TaskWidget";
import { HabitWidget } from "./HabitWidget";
import { JournalWidget } from "./JournalWidget";
import { WorkoutWidget } from "./WorkoutWidget";
import { FocusWidget } from "./FocusWidget";
import { GoalWidget } from "./GoalWidget";
import { DailyBriefing } from "./DailyBriefing";
import { InsightCards } from "./InsightCards";
import { DailyStartCard } from "./DailyStartCard";
import { formatDate, getToday } from "@/lib/dates";
import { Task } from "@/types/database";

interface DashboardData {
  tasks: { total: number; done: number; topPriorities: Task[] };
  habits: { total: number; completedToday: number; streak: number };
  journal: { hasEntry: boolean; mood: number | null };
  workouts: { todayLog: { name: string } | null; weekCount: number };
  focus: { todayMinutes: number; todaySessions: number };
  goals: { activeCount: number; topGoals: { id: string; title: string; progress: number; category: string; target_date: string | null }[] };
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        setData(await response.json());
        return;
      }
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.error) detail = String(body.error);
      } catch {
        // ignore non-JSON error bodies
      }
      setData(null);
      setError(detail);
      console.error("Failed to load dashboard:", detail);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      setData(null);
      setError(detail);
      console.error("Failed to load dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const longDate = useMemo(() => formatDate(getToday(), "long"), []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
        <div className="icon-badge w-12 h-12" style={{ width: "3rem", height: "3rem" }}>
          <LayoutDashboard className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Failed to load dashboard
        </p>
        {error && (
          <p className="text-xs text-center max-w-sm" style={{ color: "var(--text-muted)" }}>
            {error}
            {error.includes("SELF_HOSTED_USER_ID") || error.includes("Internal server error") ? (
              <>
                {" "}
                — check <code className="text-[11px]">.env.local</code> has{" "}
                <code className="text-[11px]">DATABASE_URL</code>,{" "}
                <code className="text-[11px]">SELF_HOSTED_USER_ID</code>, and a running Postgres.
              </>
            ) : null}
          </p>
        )}
        <button
          onClick={() => {
            setIsLoading(true);
            reload();
          }}
          className="btn-secondary text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const tasksLeft = Math.max(0, data.tasks.total - data.tasks.done);
  const pulseParts: string[] = [];
  if (data.habits.total > 0) {
    pulseParts.push(`${data.habits.completedToday}/${data.habits.total} habits`);
  }
  if (data.tasks.total > 0) {
    pulseParts.push(tasksLeft === 0 ? "tasks clear" : `${tasksLeft} task${tasksLeft === 1 ? "" : "s"} left`);
  }
  if (data.focus.todayMinutes > 0) {
    pulseParts.push(`${data.focus.todayMinutes}m focus`);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="page-header">
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">{longDate}</p>
          {pulseParts.length > 0 && (
            <p
              className="mt-2.5 text-[13px] font-medium tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              {pulseParts.join("  ·  ")}
            </p>
          )}
        </header>

        <DailyStartCard
          tasks={data.tasks}
          habits={data.habits}
          focus={data.focus}
          onTaskComplete={reload}
        />

        <DailyBriefing />
        <InsightCards />

        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="overline">Overview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TaskWidget
            total={data.tasks.total}
            done={data.tasks.done}
            topPriorities={data.tasks.topPriorities}
          />
          <HabitWidget
            total={data.habits.total}
            completedToday={data.habits.completedToday}
            streak={data.habits.streak}
          />
          <GoalWidget activeCount={data.goals.activeCount} topGoals={data.goals.topGoals} />
          <FocusWidget
            todayMinutes={data.focus.todayMinutes}
            todaySessions={data.focus.todaySessions}
          />
          <JournalWidget hasEntry={data.journal.hasEntry} mood={data.journal.mood} />
          <WorkoutWidget todayLog={data.workouts.todayLog} weekCount={data.workouts.weekCount} />
        </div>
      </div>
    </div>
  );
}
