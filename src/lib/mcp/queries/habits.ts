import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  target_days: number[] | null;
  color: string | null;
  archived: boolean;
  sort_order: number;
  goal_id: string | null;
  created_at: string;
}

export interface HabitWithStatus extends Habit {
  logged_today: boolean;
}

export interface HabitStats {
  id: string;
  name: string;
  color: string | null;
  streak: number;
  completionRate: number;
  recentLogs: string[];
}

export interface CreateHabitInput {
  name: string;
  description?: string;
  frequency?: string;
  target_days?: number[];
  color?: string;
  goal_id?: string;
}

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
      continue;
    }

    if (logSet.has(dateStr)) {
      started = true;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (started) {
      break;
    } else {
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

export async function getHabits(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false
): Promise<QueryResult<Habit[]>> {
  try {
    let query = supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (!includeArchived) {
      query = query.eq("archived", false);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as Habit[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getHabitsWithTodayStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<HabitWithStatus[]>> {
  try {
    const today = getToday();

    const [habitsResult, logsResult] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .eq("log_date", today),
    ]);

    if (habitsResult.error) return { data: null, error: habitsResult.error.message };
    if (logsResult.error) return { data: null, error: logsResult.error.message };

    const loggedIds = new Set((logsResult.data ?? []).map((l) => l.habit_id));
    const habitsWithStatus: HabitWithStatus[] = (habitsResult.data as Habit[]).map((h) => ({
      ...h,
      logged_today: loggedIds.has(h.id),
    }));

    return { data: habitsWithStatus, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createHabit(
  supabase: SupabaseClient,
  userId: string,
  input: CreateHabitInput
): Promise<QueryResult<Habit>> {
  try {
    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        name: input.name.trim(),
        ...(input.description ? { description: input.description } : {}),
        ...(input.frequency ? { frequency: input.frequency } : {}),
        ...(input.target_days ? { target_days: input.target_days } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.goal_id !== undefined ? { goal_id: input.goal_id || null } : {}),
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Habit, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleHabitLog(
  supabase: SupabaseClient,
  userId: string,
  habitId: string,
  date: string
): Promise<QueryResult<{ logged: boolean }>> {
  try {
    // Verify the habit belongs to the user
    const { error: habitError } = await supabase
      .from("habits")
      .select("id")
      .eq("id", habitId)
      .eq("user_id", userId)
      .single();

    if (habitError) return { data: null, error: "Habit not found" };

    // Check if a log already exists for this habit + date
    const { data: existingLog } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("habit_id", habitId)
      .eq("log_date", date)
      .single();

    if (existingLog) {
      const { error: deleteError } = await supabase
        .from("habit_logs")
        .delete()
        .eq("id", existingLog.id);

      if (deleteError) return { data: null, error: deleteError.message };
      return { data: { logged: false }, error: null };
    } else {
      const { error: insertError } = await supabase
        .from("habit_logs")
        .insert({ habit_id: habitId, log_date: date, user_id: userId });

      if (insertError) return { data: null, error: insertError.message };
      return { data: { logged: true }, error: null };
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getHabitStats(
  supabase: SupabaseClient,
  userId: string,
  habitId: string,
  days = 30
): Promise<QueryResult<HabitStats>> {
  try {
    const safeDays = Math.max(1, days);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (safeDays - 1));
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = today.toISOString().split("T")[0];

    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("id, name, color, target_days")
      .eq("id", habitId)
      .eq("user_id", userId)
      .single();

    if (habitError) return { data: null, error: "Habit not found" };

    const { data: logs, error: logsError } = await supabase
      .from("habit_logs")
      .select("log_date")
      .eq("habit_id", habitId)
      .gte("log_date", startDateStr)
      .lte("log_date", endDateStr);

    if (logsError) return { data: null, error: logsError.message };

    const habitLogs = (logs ?? []).map((l) => l.log_date);
    const targetDays: number[] =
      Array.isArray(habit.target_days) && habit.target_days.length > 0
        ? habit.target_days
        : [1, 2, 3, 4, 5, 6, 7];

    const streak = calculateStreak(habitLogs, targetDays);
    const applicableDays = getApplicableDays(startDate, today, targetDays);
    const completionRate = applicableDays > 0 ? habitLogs.length / applicableDays : 0;
    const recentLogs = [...new Set(habitLogs)].sort().reverse();

    return {
      data: {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        streak,
        completionRate: Math.min(1, completionRate),
        recentLogs,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
