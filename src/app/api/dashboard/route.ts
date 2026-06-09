import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, habits, habitLogs, journalEntries, workoutLogs, focusSessions, goals } from "@/lib/db/schema";
import { eq, and, gte, lte, asc, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getToday, addDays } from "@/lib/dates";
import { calculateStreak } from "@/lib/habit-stats";

export async function GET() {
  const userId = getUserId();

  const today = getToday();
  const weekAgo = addDays(today, -7);
  // Fetch enough log history to compute a streak (up to 365 days back)
  const streakWindowStart = addDays(today, -364);

  try {
    const [
      allTasksToday,
      topPriorityTasks,
      allHabits,
      todayHabitLogs,
      todayJournal,
      todayWorkout,
      weekWorkouts,
      todayFocus,
      activeGoals,
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
          done_at: tasks.doneAt,
          task_date: tasks.taskDate,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, today), eq(tasks.done, false)))
        .orderBy(asc(tasks.sortOrder))
        .limit(3),
      db
        .select({ id: habits.id, name: habits.name, targetDays: habits.targetDays })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
      db
        .select({ habitId: habitLogs.habitId })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, today))),
      db
        .select({ mood: journalEntries.mood })
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, today)))
        .limit(1),
      db
        .select()
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
            gte(focusSessions.startedAt, new Date(`${today}T00:00:00`))
          )
        ),
      db
        .select({
          id: goals.id,
          title: goals.title,
          progress: goals.progress,
          category: goals.category,
          target_date: goals.targetDate,
        })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
        .orderBy(asc(goals.targetDate))
        .limit(3),
    ]);

    const totalTasks = allTasksToday.length;
    const doneTasks = allTasksToday.filter((t) => t.done).length;

    const completedHabitIds = new Set(todayHabitLogs.map((l) => l.habitId));
    const completedHabitsToday = allHabits.filter((h) => completedHabitIds.has(h.id)).length;

    // Compute the maximum current streak across all habits (one batch query).
    let maxStreak = 0;
    if (allHabits.length > 0) {
      const habitIds = allHabits.map((h) => h.id);
      const streakLogs = await db
        .select({ habitId: habitLogs.habitId, logDate: habitLogs.logDate })
        .from(habitLogs)
        .where(
          and(
            inArray(habitLogs.habitId, habitIds),
            gte(habitLogs.logDate, streakWindowStart),
            lte(habitLogs.logDate, today)
          )
        );

      // Group logs by habit
      const logsByHabit: Record<string, string[]> = {};
      for (const log of streakLogs) {
        if (!logsByHabit[log.habitId]) logsByHabit[log.habitId] = [];
        logsByHabit[log.habitId].push(log.logDate);
      }

      for (const habit of allHabits) {
        const targetDays: number[] =
          Array.isArray(habit.targetDays) && habit.targetDays.length > 0
            ? habit.targetDays
            : [1, 2, 3, 4, 5, 6, 7];
        const streak = calculateStreak(logsByHabit[habit.id] ?? [], targetDays);
        if (streak > maxStreak) maxStreak = streak;
      }
    }

    const todayFocusMinutes = todayFocus.reduce((s, f) => s + (f.durationMinutes ?? 0), 0);
    const weekCount = weekWorkouts.length;
    const todayLog = todayWorkout[0] ?? null;

    return NextResponse.json({
      tasks: {
        total: totalTasks,
        done: doneTasks,
        topPriorities: topPriorityTasks,
      },
      habits: {
        total: allHabits.length,
        completedToday: completedHabitsToday,
        streak: maxStreak,
      },
      journal: {
        hasEntry: todayJournal.length > 0,
        mood: todayJournal[0]?.mood ?? null,
      },
      workouts: {
        todayLog,
        weekCount,
      },
      focus: {
        todayMinutes: todayFocusMinutes,
        todaySessions: todayFocus.length,
      },
      goals: {
        activeCount: activeGoals.length,
        topGoals: activeGoals,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
