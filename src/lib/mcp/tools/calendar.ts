import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { tasks, habits, habitLogs, journalEntries, workoutLogs, focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte, or, lt } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getDaySummary(userId: string, date: string) {
  try {
    const [tasksRows, habitsRows, journalRows, workoutsRows, focusRows] = await Promise.all([
      db
        .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, done: tasks.done, taskDate: tasks.taskDate })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            or(
              eq(tasks.taskDate, date),
              and(lt(tasks.taskDate, date), eq(tasks.done, false))
            )
          )
        ),
      db
        .select({ id: habits.id, name: habits.name, targetDays: habits.targetDays })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
      db
        .select({ id: journalEntries.id, content: journalEntries.content, mood: journalEntries.mood, entryDate: journalEntries.entryDate })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, date))),
      db
        .select({ id: workoutLogs.id, name: workoutLogs.name, durationMinutes: workoutLogs.durationMinutes, logDate: workoutLogs.logDate })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, date))),
      db
        .select({ id: focusSessions.id, durationMinutes: focusSessions.durationMinutes, completedAt: focusSessions.completedAt, startedAt: focusSessions.startedAt })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, new Date(`${date}T00:00:00.000Z`)),
            lte(focusSessions.startedAt, new Date(`${date}T23:59:59.999Z`))
          )
        ),
    ]);

    // Habit logs for this date
    const habitLogRows = await db
      .select({ habitId: habitLogs.habitId })
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, date)));

    const completedHabitIds = new Set(habitLogRows.map((hl) => hl.habitId));

    const completedTasks = tasksRows.filter((t) => t.done);
    const completedFocus = focusRows.filter((s) => s.completedAt != null);
    const totalFocusMinutes = completedFocus.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

    return {
      data: {
        date,
        tasks: {
          total: tasksRows.length,
          completed: completedTasks.length,
          items: tasksRows,
        },
        habits: {
          completed: habitLogRows.length,
          items: habitsRows.filter((h) => completedHabitIds.has(h.id)),
        },
        journal: journalRows.length > 0 ? journalRows[0] : null,
        workouts: workoutsRows,
        focus: {
          totalMinutes: totalFocusMinutes,
          sessionCount: completedFocus.length,
        },
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getWeekSummary(userId: string, weekStart: string) {
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const weekEnd = endDate.toISOString().split("T")[0];

  try {
    const [tasksRows, habitLogsRows, workoutsRows, focusRows, journalRows] = await Promise.all([
      db
        .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, done: tasks.done, taskDate: tasks.taskDate })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), gte(tasks.taskDate, weekStart), lte(tasks.taskDate, weekEnd))),
      db
        .select({ habitId: habitLogs.habitId, logDate: habitLogs.logDate })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), gte(habitLogs.logDate, weekStart), lte(habitLogs.logDate, weekEnd))),
      db
        .select({ id: workoutLogs.id, name: workoutLogs.name, durationMinutes: workoutLogs.durationMinutes, logDate: workoutLogs.logDate })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), gte(workoutLogs.logDate, weekStart), lte(workoutLogs.logDate, weekEnd))),
      db
        .select({ id: focusSessions.id, durationMinutes: focusSessions.durationMinutes, completedAt: focusSessions.completedAt, startedAt: focusSessions.startedAt })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, new Date(`${weekStart}T00:00:00.000Z`)),
            lte(focusSessions.startedAt, new Date(`${weekEnd}T23:59:59.999Z`))
          )
        ),
      db
        .select({ id: journalEntries.id, entryDate: journalEntries.entryDate, mood: journalEntries.mood })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), gte(journalEntries.entryDate, weekStart), lte(journalEntries.entryDate, weekEnd))),
    ]);

    const completedTasks = tasksRows.filter((t) => t.done);
    const completedFocus = focusRows.filter((s) => s.completedAt != null);
    const totalFocusMinutes = completedFocus.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

    const moods = journalRows.filter((j) => j.mood != null).map((j) => j.mood as number);
    const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

    return {
      data: {
        weekStart,
        weekEnd,
        tasks: {
          total: tasksRows.length,
          completed: completedTasks.length,
          completionRate: tasksRows.length > 0 ? Math.round((completedTasks.length / tasksRows.length) * 100) : 0,
        },
        habits: {
          totalCompletions: habitLogsRows.length,
        },
        workouts: {
          count: workoutsRows.length,
          totalMinutes: workoutsRows.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0),
        },
        focus: {
          totalMinutes: totalFocusMinutes,
          sessionCount: completedFocus.length,
        },
        journal: {
          entriesWritten: journalRows.length,
          averageMood: avgMood,
        },
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
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

      let weekStart = args.week_start;
      if (!weekStart) {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        now.setDate(now.getDate() + diff);
        weekStart = now.toISOString().split("T")[0];
      }

      const result = await getWeekSummary(auth.userId, weekStart);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
