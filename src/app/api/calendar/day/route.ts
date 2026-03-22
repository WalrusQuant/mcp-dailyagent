import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { DayDetail } from "@/components/calendar/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date parameter (YYYY-MM-DD)" }, { status: 400 });
  }

  const [tasksResult, habitLogsResult, journalResult, workoutsResult, focusResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, priority, done")
        .eq("user_id", user.id)
        .eq("task_date", date)
        .order("sort_order", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id, habits(name, color)")
        .eq("user_id", user.id)
        .eq("log_date", date),
      supabase
        .from("journal_entries")
        .select("id, mood, content")
        .eq("user_id", user.id)
        .eq("entry_date", date)
        .maybeSingle(),
      supabase
        .from("workout_logs")
        .select("id, name, duration_minutes")
        .eq("user_id", user.id)
        .eq("log_date", date)
        .order("created_at", { ascending: false }),
      supabase
        .from("focus_sessions")
        .select("id, duration_minutes, task_id, status, tasks(title)")
        .eq("user_id", user.id)
        .gte("started_at", `${date}T00:00:00`)
        .lte("started_at", `${date}T23:59:59`)
        .in("status", ["completed", "active"])
        .order("started_at", { ascending: false }),
    ]);

  // Get all active habits to show which ones are expected but not completed
  const habitsResult = await supabase
    .from("habits")
    .select("id, name, color, target_days")
    .eq("user_id", user.id)
    .eq("archived", false);

  const d = new Date(date + "T00:00:00");
  const dow = d.getDay() === 0 ? 7 : d.getDay();

  const completedHabitIds = new Set(
    (habitLogsResult.data ?? []).map((hl: Record<string, unknown>) => hl.habit_id as string)
  );

  const habits = (habitsResult.data ?? [])
    .filter((h) => h.target_days.includes(dow))
    .map((h) => ({
      name: h.name,
      color: h.color,
      completed: completedHabitIds.has(h.id),
    }));

  const detail: DayDetail = {
    date,
    tasks: (tasksResult.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      done: t.done,
    })),
    habits,
    journal: journalResult.data
      ? {
          id: journalResult.data.id,
          mood: journalResult.data.mood,
          content: journalResult.data.content,
        }
      : null,
    workouts: (workoutsResult.data ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      duration_minutes: w.duration_minutes,
    })),
    focus: (focusResult.data ?? []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      duration_minutes: f.duration_minutes as number,
      task_title: (f.tasks as { title: string } | null)?.title ?? null,
      status: f.status as string,
    })),
  };

  return NextResponse.json(detail);
}
