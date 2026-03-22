import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProductivitySnapshot } from "@/lib/productivity-context";
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

  const snapshot = await getProductivitySnapshot(supabase, user.id);

  // Dashboard needs slightly richer data than the snapshot provides
  // Fetch today's workout log detail and top priorities with full task objects
  const today = new Date().toISOString().slice(0, 10);
  const [tasksResult, workoutTodayResult, goalsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, done, done_at, task_date")
      .eq("user_id", user.id)
      .eq("task_date", today)
      .eq("done", false)
      .order("sort_order", { ascending: true })
      .limit(3),
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("id, title, progress, category, target_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("target_date", { ascending: true, nullsFirst: false })
      .limit(3),
  ]);

  const todayLog = (workoutTodayResult.data as WorkoutLog | null) ?? null;

  return NextResponse.json({
    tasks: {
      total: snapshot.tasks.total,
      done: snapshot.tasks.done,
      topPriorities: tasksResult.data ?? [],
    },
    habits: {
      total: snapshot.habits.total,
      completedToday: snapshot.habits.completedToday,
      streak: snapshot.habits.streak,
    },
    journal: {
      hasEntry: snapshot.journal.hasEntry,
      mood: snapshot.journal.mood,
    },
    workouts: {
      todayLog,
      weekCount: snapshot.workouts.weekCount,
    },
    focus: {
      todayMinutes: snapshot.focus.todayMinutes,
      todaySessions: snapshot.focus.todaySessions,
    },
    goals: {
      activeCount: goalsResult.data?.length ?? 0,
      topGoals: goalsResult.data ?? [],
    },
  });
}
