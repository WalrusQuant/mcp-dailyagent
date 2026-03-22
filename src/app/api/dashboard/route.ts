import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { WorkoutLog } from "@/types/database";

// GET today's dashboard snapshot
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

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
    // All tasks today (for total/done counts)
    supabase
      .from("tasks")
      .select("done")
      .eq("user_id", user.id)
      .eq("task_date", today),
    // Top undone priority tasks
    supabase
      .from("tasks")
      .select("id, title, priority, done, done_at, task_date")
      .eq("user_id", user.id)
      .eq("task_date", today)
      .eq("done", false)
      .order("sort_order", { ascending: true })
      .limit(3),
    // Active habits
    supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("archived", false),
    // Today's habit logs
    supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("user_id", user.id)
      .eq("log_date", today),
    // Today's journal entry
    supabase
      .from("journal_entries")
      .select("mood")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .maybeSingle(),
    // Today's workout
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // This week's workout count
    supabase
      .from("workout_logs")
      .select("id")
      .eq("user_id", user.id)
      .gte("log_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .lte("log_date", today),
    // Today's focus sessions
    supabase
      .from("focus_sessions")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${today}T00:00:00.000Z`),
    // Active goals
    supabase
      .from("goals")
      .select("id, title, progress, category, target_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("target_date", { ascending: true, nullsFirst: false })
      .limit(3),
  ]);

  const tasks = tasksAllResult.data ?? [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;

  const habits = habitsResult.data ?? [];
  const completedHabitIds = new Set((habitLogsResult.data ?? []).map((l) => l.habit_id));
  const completedHabitsToday = habits.filter((h) => completedHabitIds.has(h.id)).length;

  const focusSessions = focusResult.data ?? [];
  const todayFocusMinutes = focusSessions.reduce((s, f) => s + (f.duration_minutes ?? 0), 0);

  const todayLog = (workoutTodayResult.data as WorkoutLog | null) ?? null;
  const weekCount = workoutWeekResult.data?.length ?? 0;

  return NextResponse.json({
    tasks: {
      total: totalTasks,
      done: doneTasks,
      topPriorities: tasksPriorityResult.data ?? [],
    },
    habits: {
      total: habits.length,
      completedToday: completedHabitsToday,
      streak: 0, // Streak calculation requires historical data; omitted for performance
    },
    journal: {
      hasEntry: journalResult.data !== null,
      mood: journalResult.data?.mood ?? null,
    },
    workouts: {
      todayLog,
      weekCount,
    },
    focus: {
      todayMinutes: todayFocusMinutes,
      todaySessions: focusSessions.length,
    },
    goals: {
      activeCount: goalsResult.data?.length ?? 0,
      topGoals: goalsResult.data ?? [],
    },
  });
}
