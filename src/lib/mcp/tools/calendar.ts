import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getDaySummary(userId: string, date: string) {
  const supabase = getServiceClient();

  const [tasksRes, habitsRes, journalRes, workoutsRes, focusRes] = await Promise.all([
    // Tasks for the day (including rolled-over incomplete)
    supabase
      .from("tasks")
      .select("id, title, priority, done, task_date")
      .eq("user_id", userId)
      .or(`task_date.eq.${date},and(task_date.lt.${date},done.eq.false)`)
      .order("priority", { ascending: true }),

    // Habit completions for the day
    supabase
      .from("habits")
      .select("id, name, habit_logs!inner(log_date)")
      .eq("user_id", userId)
      .eq("habit_logs.log_date", date),

    // Journal entry for the day
    supabase
      .from("journal_entries")
      .select("id, content, mood, entry_date")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .single(),

    // Workouts for the day
    supabase
      .from("workout_logs")
      .select("id, name, duration_minutes, log_date")
      .eq("user_id", userId)
      .eq("log_date", date),

    // Focus sessions for the day
    supabase
      .from("focus_sessions")
      .select("id, duration_minutes, completed_at, started_at")
      .eq("user_id", userId)
      .gte("started_at", `${date}T00:00:00.000Z`)
      .lte("started_at", `${date}T23:59:59.999Z`),
  ]);

  const tasks = tasksRes.data ?? [];
  const completedTasks = tasks.filter((t) => t.done);

  const focusSessions = focusRes.data ?? [];
  const completedFocus = focusSessions.filter((s) => s.completed_at != null);
  const totalFocusMinutes = completedFocus.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  return {
    data: {
      date,
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        items: tasks,
      },
      habits: {
        completed: habitsRes.data?.length ?? 0,
        items: habitsRes.data ?? [],
      },
      journal: journalRes.data ?? null,
      workouts: workoutsRes.data ?? [],
      focus: {
        totalMinutes: totalFocusMinutes,
        sessionCount: completedFocus.length,
      },
    },
    error: null,
  };
}

async function getWeekSummary(userId: string, weekStart: string) {
  const supabase = getServiceClient();

  // Calculate week end (6 days after start)
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const weekEnd = endDate.toISOString().split("T")[0];

  const [tasksRes, habitLogsRes, workoutsRes, focusRes, journalRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, done, task_date")
      .eq("user_id", userId)
      .gte("task_date", weekStart)
      .lte("task_date", weekEnd),

    supabase
      .from("habit_logs")
      .select("habit_id, log_date, habits!inner(name, user_id)")
      .gte("log_date", weekStart)
      .lte("log_date", weekEnd)
      .eq("habits.user_id", userId),

    supabase
      .from("workout_logs")
      .select("id, name, duration_minutes, log_date")
      .eq("user_id", userId)
      .gte("log_date", weekStart)
      .lte("log_date", weekEnd),

    supabase
      .from("focus_sessions")
      .select("id, duration_minutes, completed_at, started_at")
      .eq("user_id", userId)
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),

    supabase
      .from("journal_entries")
      .select("id, entry_date, mood")
      .eq("user_id", userId)
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd),
  ]);

  const tasks = tasksRes.data ?? [];
  const completedTasks = tasks.filter((t) => t.done);

  const focusSessions = focusRes.data ?? [];
  const completedFocus = focusSessions.filter((s) => s.completed_at != null);
  const totalFocusMinutes = completedFocus.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  const moods = (journalRes.data ?? []).filter((j) => j.mood != null).map((j) => j.mood as number);
  const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

  return {
    data: {
      weekStart,
      weekEnd,
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      },
      habits: {
        totalCompletions: habitLogsRes.data?.length ?? 0,
      },
      workouts: {
        count: workoutsRes.data?.length ?? 0,
        totalMinutes: (workoutsRes.data ?? []).reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0),
      },
      focus: {
        totalMinutes: totalFocusMinutes,
        sessionCount: completedFocus.length,
      },
      journal: {
        entriesWritten: journalRes.data?.length ?? 0,
        averageMood: avgMood,
      },
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCalendarTools(server: McpServer) {
  // --- get_day_summary (READ) ---
  server.tool(
    "get_day_summary",
    "Get a comprehensive summary of a day including tasks, habits, journal, workouts, and focus sessions",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "calendar:read");
      if (scopeError) return errorResult(scopeError);

      const date = args.date ?? new Date().toISOString().split("T")[0];
      const result = await getDaySummary(auth.userId, date);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- get_week_summary (READ) ---
  server.tool(
    "get_week_summary",
    "Get an aggregated summary of a full week including task completion, habits, workouts, focus time, and mood",
    {
      week_start: z.string().optional().describe("Week start date in YYYY-MM-DD format (defaults to this Monday)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "calendar:read");
      if (scopeError) return errorResult(scopeError);

      // Default to the most recent Monday
      let weekStart = args.week_start;
      if (!weekStart) {
        const now = new Date();
        const day = now.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        now.setDate(now.getDate() + diff);
        weekStart = now.toISOString().split("T")[0];
      }

      const result = await getWeekSummary(auth.userId, weekStart);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
