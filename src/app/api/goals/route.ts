import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "active";

  let query = supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter as "active" | "completed" | "abandoned");
  }

  const { data: goals, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For auto-progress goals, compute progress from linked tasks/habits
  const autoGoals = (goals ?? []).filter((g) => g.progress_mode === "auto");
  if (autoGoals.length > 0) {
    const goalIds = autoGoals.map((g) => g.id);
    const today = new Date().toISOString().slice(0, 10);

    const [tasksResult, habitsResult, habitLogsResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("goal_id, done")
        .in("goal_id", goalIds),
      supabase
        .from("habits")
        .select("id, goal_id")
        .in("goal_id", goalIds)
        .eq("archived", false),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", user.id)
        .eq("log_date", today),
    ]);

    const tasksByGoal = new Map<string, { total: number; done: number }>();
    for (const t of tasksResult.data ?? []) {
      if (!t.goal_id) continue;
      const counts = tasksByGoal.get(t.goal_id) ?? { total: 0, done: 0 };
      counts.total++;
      if (t.done) counts.done++;
      tasksByGoal.set(t.goal_id, counts);
    }

    const todayLogSet = new Set((habitLogsResult.data ?? []).map((l) => l.habit_id));
    const habitsByGoal = new Map<string, { total: number; completed: number }>();
    for (const h of habitsResult.data ?? []) {
      if (!h.goal_id) continue;
      const counts = habitsByGoal.get(h.goal_id) ?? { total: 0, completed: 0 };
      counts.total++;
      if (todayLogSet.has(h.id)) counts.completed++;
      habitsByGoal.set(h.goal_id, counts);
    }

    for (const goal of autoGoals) {
      const tasks = tasksByGoal.get(goal.id);
      const habits = habitsByGoal.get(goal.id);

      let progress = 0;
      let hasLinked = false;

      if (tasks && tasks.total > 0) {
        hasLinked = true;
        const taskProgress = Math.round((tasks.done / tasks.total) * 100);
        if (habits && habits.total > 0) {
          const habitProgress = Math.round((habits.completed / habits.total) * 100);
          progress = Math.round((taskProgress + habitProgress) / 2);
        } else {
          progress = taskProgress;
        }
      } else if (habits && habits.total > 0) {
        hasLinked = true;
        progress = Math.round((habits.completed / habits.total) * 100);
      }

      if (hasLinked && progress !== goal.progress) {
        goal.progress = progress;
        await supabase.from("goals").update({ progress, updated_at: new Date().toISOString() }).eq("id", goal.id);
      }

      // Upsert today's progress log
      await supabase.from("goal_progress_logs").upsert(
        { goal_id: goal.id, user_id: user.id, log_date: today, progress: goal.progress },
        { onConflict: "goal_id,log_date" }
      );
    }
  }

  return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, category, target_date, progress_mode, progress, sort_order } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title: title.trim(),
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      ...(target_date ? { target_date } : {}),
      ...(progress_mode ? { progress_mode } : {}),
      ...(typeof progress === "number" ? { progress } : {}),
      ...(typeof sort_order === "number" ? { sort_order } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
