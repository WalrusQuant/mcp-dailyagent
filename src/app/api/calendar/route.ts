import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCalendarGridDates } from "@/lib/dates";
import type { DaySummary } from "@/components/calendar/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month parameter (YYYY-MM)" }, { status: 400 });
  }

  const gridDates = getCalendarGridDates(month);
  const startDate = gridDates[0];
  const endDate = gridDates[gridDates.length - 1];

  const [tasksResult, habitLogsResult, habitsResult, journalResult, workoutsResult, focusResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("task_date, priority, done")
        .eq("user_id", user.id)
        .gte("task_date", startDate)
        .lte("task_date", endDate),
      supabase
        .from("habit_logs")
        .select("log_date, habit_id")
        .eq("user_id", user.id)
        .gte("log_date", startDate)
        .lte("log_date", endDate),
      supabase
        .from("habits")
        .select("id, color, target_days")
        .eq("user_id", user.id)
        .eq("archived", false),
      supabase
        .from("journal_entries")
        .select("entry_date, mood")
        .eq("user_id", user.id)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate),
      supabase
        .from("workout_logs")
        .select("log_date")
        .eq("user_id", user.id)
        .gte("log_date", startDate)
        .lte("log_date", endDate),
      supabase
        .from("focus_sessions")
        .select("started_at, duration_minutes, status")
        .eq("user_id", user.id)
        .gte("started_at", `${startDate}T00:00:00`)
        .lte("started_at", `${endDate}T23:59:59`)
        .in("status", ["completed", "active"]),
    ]);

  // Build habit color map
  const habitMap = new Map<string, { color: string; targetDays: number[] }>();
  for (const h of habitsResult.data ?? []) {
    habitMap.set(h.id, { color: h.color, targetDays: h.target_days });
  }

  // Aggregate into day summaries
  const summaries: Record<string, DaySummary> = {};

  const ensureDay = (date: string): DaySummary => {
    if (!summaries[date]) {
      summaries[date] = {
        tasks: { total: 0, done: 0, hasA: false, hasB: false, hasC: false },
        habits: { total: 0, completed: 0, colors: [] },
        journal: { hasEntry: false, mood: null },
        workouts: { count: 0 },
        focus: { sessions: 0, minutes: 0 },
      };
    }
    return summaries[date];
  };

  // Tasks
  for (const t of tasksResult.data ?? []) {
    const day = ensureDay(t.task_date);
    day.tasks.total++;
    if (t.done) day.tasks.done++;
    if (t.priority === "A") day.tasks.hasA = true;
    else if (t.priority === "B") day.tasks.hasB = true;
    else if (t.priority === "C") day.tasks.hasC = true;
  }

  // Habit logs
  for (const hl of habitLogsResult.data ?? []) {
    const day = ensureDay(hl.log_date);
    day.habits.completed++;
    const habit = habitMap.get(hl.habit_id);
    if (habit && !day.habits.colors.includes(habit.color)) {
      day.habits.colors.push(habit.color);
    }
  }

  // Compute expected habits per day
  for (const date of gridDates) {
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon, 7=Sun
    let expectedCount = 0;
    for (const [, habit] of habitMap) {
      if (habit.targetDays.includes(dow)) expectedCount++;
    }
    if (expectedCount > 0) {
      const day = ensureDay(date);
      day.habits.total = expectedCount;
    }
  }

  // Journal
  for (const j of journalResult.data ?? []) {
    const day = ensureDay(j.entry_date);
    day.journal.hasEntry = true;
    day.journal.mood = j.mood;
  }

  // Workouts
  for (const w of workoutsResult.data ?? []) {
    const day = ensureDay(w.log_date);
    day.workouts.count++;
  }

  // Focus
  for (const f of focusResult.data ?? []) {
    const date = f.started_at.split("T")[0];
    const day = ensureDay(date);
    day.focus.sessions++;
    day.focus.minutes += f.duration_minutes;
  }

  return NextResponse.json({ summaries, gridDates });
}
