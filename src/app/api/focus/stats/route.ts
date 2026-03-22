import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET focus session statistics
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "7"));

  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const { data: sessions, error } = await supabase
    .from("focus_sessions")
    .select("id, duration_minutes, started_at, status, task_id")
    .eq("user_id", user.id)
    .gte("started_at", from.toISOString())
    .order("started_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");

  const totalSessions = completedSessions.length;
  const totalMinutes = completedSessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0
  );

  // Build daily breakdown
  const dailyMap = new Map<string, { sessions: number; minutes: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { sessions: 0, minutes: 0 });
  }

  for (const s of completedSessions) {
    const key = s.started_at.slice(0, 10);
    const entry = dailyMap.get(key);
    if (entry) {
      entry.sessions += 1;
      entry.minutes += s.duration_minutes ?? 0;
    }
  }

  const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    sessions: v.sessions,
    minutes: v.minutes,
  }));

  // Top tasks by session count — join with tasks for title
  const taskSessionCounts = new Map<string, number>();
  for (const s of completedSessions) {
    if (s.task_id) {
      taskSessionCounts.set(s.task_id, (taskSessionCounts.get(s.task_id) ?? 0) + 1);
    }
  }

  const taskIds = Array.from(taskSessionCounts.keys());
  let topTasks: Array<{ taskTitle: string; sessions: number }> = [];

  if (taskIds.length > 0) {
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", taskIds)
      .eq("user_id", user.id);

    if (!tasksError && tasks) {
      topTasks = tasks
        .map((t) => ({
          taskTitle: t.title,
          sessions: taskSessionCounts.get(t.id) ?? 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 5);
    }
  }

  return NextResponse.json({
    totalSessions,
    totalMinutes,
    dailyBreakdown,
    topTasks,
  });
}
