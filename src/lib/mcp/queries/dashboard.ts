import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface DashboardTask {
  id: string;
  title: string;
  priority: string;
  done: boolean;
  done_at: string | null;
  task_date: string;
}

export interface DashboardGoal {
  id: string;
  title: string;
  progress: number;
  category: string | null;
  target_date: string | null;
}

export interface DashboardSnapshot {
  tasks: {
    total: number;
    done: number;
    topPriorities: DashboardTask[];
  };
  habits: {
    total: number;
    completedToday: number;
  };
  journal: {
    hasEntry: boolean;
    mood: number | null;
  };
  workouts: {
    todayName: string | null;
    weekCount: number;
  };
  focus: {
    todayMinutes: number;
    todaySessions: number;
  };
  goals: {
    activeCount: number;
    topGoals: DashboardGoal[];
  };
}

export async function getDashboardSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<DashboardSnapshot>> {
  try {
    const today = getToday();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [
      tasksAllResult,
      tasksPriorityResult,
      habitsResult,
      habitLogsResult,
      journalResult,
      workoutTodayResult,
      workoutWeekResult,
      focusResult,
      goalsResult,
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("done")
        .eq("user_id", userId)
        .eq("task_date", today),
      supabase
        .from("tasks")
        .select("id, title, priority, done, done_at, task_date")
        .eq("user_id", userId)
        .eq("task_date", today)
        .eq("done", false)
        .order("sort_order", { ascending: true })
        .limit(3),
      supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", userId)
        .eq("archived", false),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .eq("log_date", today),
      supabase
        .from("journal_entries")
        .select("mood")
        .eq("user_id", userId)
        .eq("entry_date", today)
        .maybeSingle(),
      supabase
        .from("workout_logs")
        .select("name")
        .eq("user_id", userId)
        .eq("log_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workout_logs")
        .select("id")
        .eq("user_id", userId)
        .gte("log_date", weekAgo)
        .lte("log_date", today),
      supabase
        .from("focus_sessions")
        .select("duration_minutes")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("started_at", `${today}T00:00:00.000Z`),
      supabase
        .from("goals")
        .select("id, title, progress, category, target_date")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("target_date", { ascending: true, nullsFirst: false })
        .limit(3),
    ]);

    if (tasksAllResult.error) return { data: null, error: tasksAllResult.error.message };

    const tasks = tasksAllResult.data ?? [];
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t: { done: boolean }) => t.done).length;

    const habits = habitsResult.data ?? [];
    const completedHabitIds = new Set(
      (habitLogsResult.data ?? []).map((l: { habit_id: string }) => l.habit_id)
    );
    const completedHabitsToday = habits.filter((h: { id: string }) =>
      completedHabitIds.has(h.id)
    ).length;

    const focusSessions = focusResult.data ?? [];
    const todayFocusMinutes = focusSessions.reduce(
      (s: number, f: { duration_minutes: number | null }) => s + (f.duration_minutes ?? 0),
      0
    );

    return {
      data: {
        tasks: {
          total: totalTasks,
          done: doneTasks,
          topPriorities: (tasksPriorityResult.data ?? []) as DashboardTask[],
        },
        habits: {
          total: habits.length,
          completedToday: completedHabitsToday,
        },
        journal: {
          hasEntry: journalResult.data !== null,
          mood: (journalResult.data?.mood as number | null) ?? null,
        },
        workouts: {
          todayName: (workoutTodayResult.data?.name as string | null) ?? null,
          weekCount: workoutWeekResult.data?.length ?? 0,
        },
        focus: {
          todayMinutes: todayFocusMinutes,
          todaySessions: focusSessions.length,
        },
        goals: {
          activeCount: goalsResult.data?.length ?? 0,
          topGoals: (goalsResult.data ?? []) as DashboardGoal[],
        },
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
