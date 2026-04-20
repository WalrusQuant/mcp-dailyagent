import { db } from "@/lib/db/client";
import { tasks, habits, habitLogs, journalEntries, workoutLogs, focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
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
  userId: string,
  date: string
): Promise<QueryResult<DayDetail>> {
  try {
    const [tasksRows, habitLogsRows, journalRows, workoutsRows, focusRows, habitsRows] =
      await Promise.all([
        db
          .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, done: tasks.done })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, date))),
        db
          .select({ habitId: habitLogs.habitId })
          .from(habitLogs)
          .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, date))),
        db
          .select({ id: journalEntries.id, mood: journalEntries.mood, content: journalEntries.content })
          .from(journalEntries)
          .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, date))),
        db
          .select({ id: workoutLogs.id, name: workoutLogs.name, durationMinutes: workoutLogs.durationMinutes })
          .from(workoutLogs)
          .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, date))),
        db
          .select({ id: focusSessions.id, durationMinutes: focusSessions.durationMinutes, status: focusSessions.status })
          .from(focusSessions)
          .where(
            and(
              eq(focusSessions.userId, userId),
              gte(focusSessions.startedAt, new Date(`${date}T00:00:00`)),
              lte(focusSessions.startedAt, new Date(`${date}T23:59:59`))
            )
          ),
        db
          .select({ id: habits.id, name: habits.name, color: habits.color, targetDays: habits.targetDays })
          .from(habits)
          .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
      ]);

    const d = new Date(date + "T00:00:00");
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    const completedHabitIds = new Set(habitLogsRows.map((hl) => hl.habitId));

    const habitsDetail: DayHabit[] = habitsRows
      .filter((h) => h.targetDays?.includes(dow))
      .map((h) => ({
        name: h.name,
        color: h.color ?? null,
        completed: completedHabitIds.has(h.id),
      }));

    const detail: DayDetail = {
      date,
      tasks: tasksRows.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        done: t.done,
      })),
      habits: habitsDetail,
      journal:
        journalRows.length > 0
          ? {
              id: journalRows[0].id,
              mood: journalRows[0].mood ?? null,
              content: journalRows[0].content,
            }
          : null,
      workouts: workoutsRows.map((w) => ({
        id: w.id,
        name: w.name,
        duration_minutes: w.durationMinutes ?? null,
      })),
      focus: focusRows.map((f) => ({
        id: f.id,
        duration_minutes: f.durationMinutes,
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
  userId: string,
  weekStartParam?: string
): Promise<QueryResult<WeekSummary>> {
  try {
    const today = getToday();
    const weekStart = weekStartParam || startOfWeek(today);
    const weekEnd = endOfWeek(weekStart);

    const gridDates = getCalendarGridDates(today.slice(0, 7));

    const [tasksRows, habitLogsRows, habitsRows, journalRows, workoutsRows, focusRows] =
      await Promise.all([
        db
          .select({ taskDate: tasks.taskDate, priority: tasks.priority, done: tasks.done })
          .from(tasks)
          .where(
            and(eq(tasks.userId, userId), gte(tasks.taskDate, weekStart), lte(tasks.taskDate, weekEnd))
          ),
        db
          .select({ logDate: habitLogs.logDate, habitId: habitLogs.habitId })
          .from(habitLogs)
          .where(
            and(
              eq(habitLogs.userId, userId),
              gte(habitLogs.logDate, weekStart),
              lte(habitLogs.logDate, weekEnd)
            )
          ),
        db
          .select({ id: habits.id, color: habits.color, targetDays: habits.targetDays })
          .from(habits)
          .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
        db
          .select({ entryDate: journalEntries.entryDate, mood: journalEntries.mood })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.userId, userId),
              gte(journalEntries.entryDate, weekStart),
              lte(journalEntries.entryDate, weekEnd)
            )
          ),
        db
          .select({ logDate: workoutLogs.logDate })
          .from(workoutLogs)
          .where(
            and(
              eq(workoutLogs.userId, userId),
              gte(workoutLogs.logDate, weekStart),
              lte(workoutLogs.logDate, weekEnd)
            )
          ),
        db
          .select({ startedAt: focusSessions.startedAt, durationMinutes: focusSessions.durationMinutes, status: focusSessions.status })
          .from(focusSessions)
          .where(
            and(
              eq(focusSessions.userId, userId),
              gte(focusSessions.startedAt, new Date(`${weekStart}T00:00:00`)),
              lte(focusSessions.startedAt, new Date(`${weekEnd}T23:59:59`))
            )
          ),
      ]);

    const habitMap = new Map<string, { color: string | null; targetDays: number[] }>();
    for (const h of habitsRows) {
      habitMap.set(h.id, { color: h.color ?? null, targetDays: h.targetDays ?? [] });
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

    for (const t of tasksRows) {
      const day = ensureDay(t.taskDate);
      day.tasks.total++;
      if (t.done) day.tasks.done++;
      const prio = String(t.priority ?? "")[0];
      if (prio === "A") day.tasks.hasA = true;
      else if (prio === "B") day.tasks.hasB = true;
      else if (prio === "C") day.tasks.hasC = true;
    }

    for (const hl of habitLogsRows) {
      const day = ensureDay(hl.logDate);
      day.habits.completed++;
      const habit = habitMap.get(hl.habitId);
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

    for (const j of journalRows) {
      const day = ensureDay(j.entryDate);
      day.journal.hasEntry = true;
      day.journal.mood = j.mood ?? null;
    }

    for (const w of workoutsRows) {
      ensureDay(w.logDate).workouts.count++;
    }

    for (const f of focusRows) {
      const date = f.startedAt.toISOString().split("T")[0];
      const day = ensureDay(date);
      day.focus.sessions++;
      day.focus.minutes += f.durationMinutes ?? 0;
    }

    return { data: { weekStart, weekEnd, days: summaries }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
