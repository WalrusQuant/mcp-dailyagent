"use client";

import { useState, useEffect } from "react";
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
import { formatRelativeDate, getToday } from "@/lib/dates";
import { Task } from "@/types/database";

interface DashboardData {
  tasks: { total: number; done: number; topPriorities: Task[] };
  habits: { total: number; completedToday: number; streak: number };
  journal: { hasEntry: boolean; mood: number | null };
  workouts: { todayLog: { name: string } | null; weekCount: number };
  focus: { todayMinutes: number; todaySessions: number };
  goals: { activeCount: number; topGoals: { id: string; title: string; progress: number; category: string; target_date: string | null }[] };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          setData(await response.json());
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LayoutDashboard className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Failed to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {formatRelativeDate(getToday())}
        </p>
      </div>

      <DailyBriefing />
      <DailyStartCard tasks={data.tasks} habits={data.habits} focus={data.focus} />
      <InsightCards />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskWidget total={data.tasks.total} done={data.tasks.done} topPriorities={data.tasks.topPriorities} />
        <HabitWidget total={data.habits.total} completedToday={data.habits.completedToday} streak={data.habits.streak} />
        <JournalWidget hasEntry={data.journal.hasEntry} mood={data.journal.mood} />
        <WorkoutWidget todayLog={data.workouts.todayLog} weekCount={data.workouts.weekCount} />
        <GoalWidget activeCount={data.goals.activeCount} topGoals={data.goals.topGoals} />
        <FocusWidget todayMinutes={data.focus.todayMinutes} todaySessions={data.focus.todaySessions} />
      </div>
    </div>
    </div>
  );
}
