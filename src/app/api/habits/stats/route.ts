import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function calculateStreak(logs: string[], targetDays: number[]): number {
  const logSet = new Set(logs);
  let streak = 0;
  let started = false;
  const checkDate = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const dayOfWeek = checkDate.getDay() === 0 ? 7 : checkDate.getDay();

    if (!targetDays.includes(dayOfWeek)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue; // skip non-target days
    }

    if (logSet.has(dateStr)) {
      started = true;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (started) {
      break;
    } else {
      // Haven't found first logged day yet — skip (e.g., today not logged yet)
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }
  return streak;
}

function getApplicableDays(startDate: Date, endDate: Date, targetDays: number[]): number {
  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (targetDays.includes(dayOfWeek)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

// GET habit stats for a date range
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "30"));

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = today.toISOString().split("T")[0];

  // Fetch all non-archived habits for the user
  const { data: habits, error: habitsError } = await supabase
    .from("habits")
    .select("id, name, color, target_days")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (habitsError) {
    return NextResponse.json({ error: habitsError.message }, { status: 500 });
  }

  if (!habits || habits.length === 0) {
    return NextResponse.json({ habits: [] });
  }

  const habitIds = habits.map((h) => h.id);

  // Fetch all logs in the date range for these habits in one query
  const { data: logs, error: logsError } = await supabase
    .from("habit_logs")
    .select("habit_id, log_date")
    .in("habit_id", habitIds)
    .gte("log_date", startDateStr)
    .lte("log_date", endDateStr);

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  // Group logs by habit_id
  const logsByHabit: Record<string, string[]> = {};
  for (const log of logs ?? []) {
    if (!logsByHabit[log.habit_id]) {
      logsByHabit[log.habit_id] = [];
    }
    logsByHabit[log.habit_id].push(log.log_date);
  }

  // Build stats per habit
  const habitStats = habits.map((habit) => {
    const habitLogs = logsByHabit[habit.id] ?? [];
    // target_days: array of ISO weekday numbers (1=Mon … 7=Sun). Default to all days if not set.
    const targetDays: number[] =
      Array.isArray(habit.target_days) && habit.target_days.length > 0
        ? habit.target_days
        : [1, 2, 3, 4, 5, 6, 7];

    const streak = calculateStreak(habitLogs, targetDays);

    const applicableDays = getApplicableDays(startDate, today, targetDays);
    const completionRate =
      applicableDays > 0 ? habitLogs.length / applicableDays : 0;

    const recentLogs = [...new Set(habitLogs)].sort().reverse();

    return {
      id: habit.id,
      name: habit.name,
      color: habit.color,
      streak,
      completionRate: Math.min(1, completionRate),
      recentLogs,
    };
  });

  return NextResponse.json({ habits: habitStats });
}
