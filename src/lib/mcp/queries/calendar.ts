import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday, startOfWeek, endOfWeek, getCalendarGridDates } from "@/lib/dates";

export interface DayTask {
  id: string;
  title: string;
  priority: string;
  done: boolean;
}

export interface DayHabit {
  name: string;
  color: string | null;
  completed: boolean;
}

export interface DayJournal {
  id: string;
  mood: number | null;
  content: string;
}

export interface DayWorkout {
  id: string;
  name: string;
  duration_minutes: number | null;
}

export interface DayFocusSession {
  id: string;
  duration_minutes: number;
  task_title: string | null;
  status: string;
}

export interface DayDetail {
  date: string;
  tasks: DayTask[];
  habits: DayHabit[];
  journal: { id: string; mood: number | null; content: string } | null;
  workouts: DayWorkout[];
  focus: DayFocusSession[];
}

export interface DaySummary {
  tasks: { total: number; done: number; hasA: boolean; hasB: boolean; hasC: boolean };
  habits: { total: number; completed: number; colors: string[] };
  journal: { hasEntry: boolean; mood: number | null };
  workouts: { count: number };
  focus: { sessions: number; minutes: number };
}

export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  days: Record<string, DaySummary>;
}

/** Get detailed data for a single day */
export async function getDaySummary(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<QueryResult<DayDetail>> {
  try {
    const [tasksResult, habitLogsResult, journalResult, workoutsResult, focusResult] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, priority, done")
          .eq("user_id", userId)
          .eq("task_date", date)
          .order("sort_order", { ascending: true }),
        supabase
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", userId)
          .eq("log_date", date),
        supabase
          .from("journal_entries")
          .select("id, mood, content")
          .eq("user_id", userId)
          .eq("entry_date", date)
          .maybeSingle(),
        supabase
          .from("workout_logs")
          .select("id, name, duration_minutes")
          .eq("user_id", userId)
          .eq("log_date", date)
          .order("created_at", { ascending: false }),
        supabase
          .from("focus_sessions")
          .select("id, duration_minutes, task_id, status")
          .eq("user_id", userId)
          .gte("started_at", `${date}T00:00:00`)
          .lte("started_at", `${date}T23:59:59`)
          .in("status", ["completed", "active"])
          .order("started_at", { ascending: false }),
      ]);

    const habitsResult = await supabase
      .from("habits")
      .select("id, name, color, target_days")
      .eq("user_id", userId)
      .eq("archived", false);

    const d = new Date(date + "T00:00:00");
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const completedHabitIds = new Set(
      (habitLogsResult.data ?? []).map((hl: { habit_id: string }) => hl.habit_id)
    );

    const habits: DayHabit[] = (habitsResult.data ?? [])
      .filter((h: { target_days: number[] }) => h.target_days?.includes(dow))
      .map((h: { name: string; color: string | null; id: string }) => ({
        name: h.name,
        color: h.color,
        completed: completedHabitIds.has(h.id),
      }));

    if (tasksResult.error) return { data: null, error: tasksResult.error.message };

    const detail: DayDetail = {
      date,
      tasks: (tasksResult.data ?? []).map((t: { id: string; title: string; priority: string; done: boolean }) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        done: t.done,
      })),
      habits,
      journal: journalResult.data
        ? {
            id: journalResult.data.id as string,
            mood: journalResult.data.mood as number | null,
            content: journalResult.data.content as string,
          }
        : null,
      workouts: (workoutsResult.data ?? []).map((w: { id: string; name: string; duration_minutes: number | null }) => ({
        id: w.id,
        name: w.name,
        duration_minutes: w.duration_minutes,
      })),
      focus: (focusResult.data ?? []).map((f: { id: string; duration_minutes: number; status: string }) => ({
        id: f.id,
        duration_minutes: f.duration_minutes,
        task_title: null,
        status: f.status,
      })),
    };

    return { data: detail, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Get aggregated summary for a week (defaults to the current week) */
export async function getWeekSummary(
  supabase: SupabaseClient,
  userId: string,
  weekStartParam?: string
): Promise<QueryResult<WeekSummary>> {
  try {
    const today = getToday();
    const weekStart = weekStartParam || startOfWeek(today);
    const weekEnd = endOfWeek(weekStart);

    const gridDates = getCalendarGridDates(today.slice(0, 7));
    const startDate = weekStart;
    const endDate = weekEnd;

    const [tasksResult, habitLogsResult, habitsResult, journalResult, workoutsResult, focusResult] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("task_date, priority, done")
          .eq("user_id", userId)
          .gte("task_date", startDate)
          .lte("task_date", endDate),
        supabase
          .from("habit_logs")
          .select("log_date, habit_id")
          .eq("user_id", userId)
          .gte("log_date", startDate)
          .lte("log_date", endDate),
        supabase
          .from("habits")
          .select("id, color, target_days")
          .eq("user_id", userId)
          .eq("archived", false),
        supabase
          .from("journal_entries")
          .select("entry_date, mood")
          .eq("user_id", userId)
          .gte("entry_date", startDate)
          .lte("entry_date", endDate),
        supabase
          .from("workout_logs")
          .select("log_date")
          .eq("user_id", userId)
          .gte("log_date", startDate)
          .lte("log_date", endDate),
        supabase
          .from("focus_sessions")
          .select("started_at, duration_minutes, status")
          .eq("user_id", userId)
          .gte("started_at", `${startDate}T00:00:00`)
          .lte("started_at", `${endDate}T23:59:59`)
          .in("status", ["completed", "active"]),
      ]);

    if (tasksResult.error) return { data: null, error: tasksResult.error.message };

    const habitMap = new Map<string, { color: string | null; targetDays: number[] }>();
    for (const h of habitsResult.data ?? []) {
      habitMap.set(h.id, { color: h.color, targetDays: h.target_days ?? [] });
    }

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

    for (const t of tasksResult.data ?? []) {
      const day = ensureDay(t.task_date);
      day.tasks.total++;
      if (t.done) day.tasks.done++;
      const prio = String(t.priority ?? "")[0];
      if (prio === "A") day.tasks.hasA = true;
      else if (prio === "B") day.tasks.hasB = true;
      else if (prio === "C") day.tasks.hasC = true;
    }

    for (const hl of habitLogsResult.data ?? []) {
      const day = ensureDay(hl.log_date);
      day.habits.completed++;
      const habit = habitMap.get(hl.habit_id);
      if (habit?.color && !day.habits.colors.includes(habit.color)) {
        day.habits.colors.push(habit.color);
      }
    }

    for (const date of gridDates.filter((d) => d >= weekStart && d <= weekEnd)) {
      const d = new Date(date + "T00:00:00");
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      let expectedCount = 0;
      for (const [, habit] of habitMap) {
        if (habit.targetDays.includes(dow)) expectedCount++;
      }
      if (expectedCount > 0) {
        ensureDay(date).habits.total = expectedCount;
      }
    }

    for (const j of journalResult.data ?? []) {
      const day = ensureDay(j.entry_date);
      day.journal.hasEntry = true;
      day.journal.mood = j.mood;
    }

    for (const w of workoutsResult.data ?? []) {
      ensureDay(w.log_date).workouts.count++;
    }

    for (const f of focusResult.data ?? []) {
      const date = f.started_at.split("T")[0];
      const day = ensureDay(date);
      day.focus.sessions++;
      day.focus.minutes += f.duration_minutes ?? 0;
    }

    return { data: { weekStart, weekEnd, days: summaries }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
