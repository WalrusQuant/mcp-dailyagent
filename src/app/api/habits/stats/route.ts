import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits, habitLogs } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { calculateStreak, getApplicableDays } from "@/lib/habit-stats";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "30"));

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = today.toISOString().split("T")[0];

  try {
    const habitRows = await db
      .select({
        id: habits.id,
        name: habits.name,
        color: habits.color,
        targetDays: habits.targetDays,
      })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.archived, false)))
      .orderBy(habits.sortOrder);

    if (habitRows.length === 0) {
      return NextResponse.json({ habits: [] });
    }

    const habitIds = habitRows.map((h) => h.id);

    const logs = await db
      .select({ habitId: habitLogs.habitId, logDate: habitLogs.logDate })
      .from(habitLogs)
      .where(
        and(
          inArray(habitLogs.habitId, habitIds),
          gte(habitLogs.logDate, startDateStr),
          lte(habitLogs.logDate, endDateStr)
        )
      );

    // Group logs by habit_id
    const logsByHabit: Record<string, string[]> = {};
    for (const log of logs) {
      if (!logsByHabit[log.habitId]) {
        logsByHabit[log.habitId] = [];
      }
      logsByHabit[log.habitId].push(log.logDate);
    }

    const habitStats = habitRows.map((habit) => {
      const habitLogDates = logsByHabit[habit.id] ?? [];
      const targetDays: number[] =
        Array.isArray(habit.targetDays) && habit.targetDays.length > 0
          ? habit.targetDays
          : [1, 2, 3, 4, 5, 6, 7];

      const streak = calculateStreak(habitLogDates, targetDays);
      const applicableDays = getApplicableDays(startDate, today, targetDays);
      const completionRate = applicableDays > 0 ? habitLogDates.length / applicableDays : 0;
      const recentLogs = [...new Set(habitLogDates)].sort().reverse();

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
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
