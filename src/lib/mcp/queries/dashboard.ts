import { db } from "@/lib/db/client";
import { tasks, habits, habitLogs, journalEntries, workoutLogs, focusSessions, goals } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface DashboardTask {
  id: string;
  title: string;
  priority: string;
  done: boolean;
  done_at: string | null;
  task_date: string;
}

export interface DashboardGoal {
  id: string;
  title: string;
  progress: number;
  category: string | null;
  target_date: string | null;
}

export interface DashboardSnapshot {
  tasks: {
    total: number;
    done: number;
    topPriorities: DashboardTask[];
  };
  habits: {
    total: number;
    completedToday: number;
  };
  journal: {
    hasEntry: boolean;
    mood: number | null;
  };
  workouts: {
    todayName: string | null;
    weekCount: number;
  };
  focus: {
    todayMinutes: number;
    todaySessions: number;
  };
  goals: {
    activeCount: number;
    topGoals: DashboardGoal[];
  };
}

export async function getDashboardSnapshot(
  userId: string
): Promise<QueryResult<DashboardSnapshot>> {
  try {
    const today = getToday();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [
      tasksAllRows,
      tasksPriorityRows,
      habitsRows,
      habitLogsRows,
      journalRows,
      workoutTodayRows,
      workoutWeekRows,
      focusRows,
      goalsRows,
    ] = await Promise.all([
      db
        .select({ done: tasks.done })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, today))),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority: tasks.priority,
          done: tasks.done,
          doneAt: tasks.doneAt,
          taskDate: tasks.taskDate,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, today), eq(tasks.done, false)))
        .orderBy(asc(tasks.sortOrder))
        .limit(3),
      db
        .select({ id: habits.id, name: habits.name })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
      db
        .select({ habitId: habitLogs.habitId })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, today))),
      db
        .select({ mood: journalEntries.mood })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, today))),
      db
        .select({ name: workoutLogs.name })
        .from(workoutLogs)
        .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, today)))
        .orderBy(desc(workoutLogs.createdAt))
        .limit(1),
      db
        .select({ id: workoutLogs.id })
        .from(workoutLogs)
        .where(
          and(
            eq(workoutLogs.userId, userId),
            gte(workoutLogs.logDate, weekAgo),
            lte(workoutLogs.logDate, today)
          )
        ),
      db
        .select({ durationMinutes: focusSessions.durationMinutes })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            eq(focusSessions.status, "completed"),
            gte(focusSessions.startedAt, new Date(`${today}T00:00:00.000Z`))
          )
        ),
      db
        .select({
          id: goals.id,
          title: goals.title,
          progress: goals.progress,
          category: goals.category,
          targetDate: goals.targetDate,
        })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
        .orderBy(asc(goals.targetDate))
        .limit(3),
    ]);

    const totalTasks = tasksAllRows.length;
    const doneTasks = tasksAllRows.filter((t) => t.done).length;

    const completedHabitIds = new Set(habitLogsRows.map((l) => l.habitId));
    const completedHabitsToday = habitsRows.filter((h) => completedHabitIds.has(h.id)).length;

    const todayFocusMinutes = focusRows.reduce((s, f) => s + (f.durationMinutes ?? 0), 0);

    return {
      data: {
        tasks: {
          total: totalTasks,
          done: doneTasks,
          topPriorities: tasksPriorityRows.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            done: t.done,
            done_at: t.doneAt ? t.doneAt.toISOString() : null,
            task_date: t.taskDate,
          })),
        },
        habits: {
          total: habitsRows.length,
          completedToday: completedHabitsToday,
        },
        journal: {
          hasEntry: journalRows.length > 0,
          mood: journalRows.length > 0 ? (journalRows[0].mood ?? null) : null,
        },
        workouts: {
          todayName: workoutTodayRows.length > 0 ? workoutTodayRows[0].name : null,
          weekCount: workoutWeekRows.length,
        },
        focus: {
          todayMinutes: todayFocusMinutes,
          todaySessions: focusRows.length,
        },
        goals: {
          activeCount: goalsRows.length,
          topGoals: goalsRows.map((g) => ({
            id: g.id,
            title: g.title,
            progress: g.progress,
            category: g.category ?? null,
            target_date: g.targetDate ?? null,
          })),
        },
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
