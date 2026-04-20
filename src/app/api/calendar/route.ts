import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, habitLogs, habits, journalEntries, workoutLogs, focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { getCalendarGridDates } from "@/lib/dates";
import type { DaySummary } from "@/components/calendar/types";
import { getUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month parameter (YYYY-MM)" }, { status: 400 });
  }

  const gridDates = getCalendarGridDates(month);
  const startDate = gridDates[0];
  const endDate = gridDates[gridDates.length - 1];

  try {
    const [taskRows, habitLogRows, habitRows, journalRows, workoutRows, focusRows] =
      await Promise.all([
        db
          .select({ taskDate: tasks.taskDate, priority: tasks.priority, done: tasks.done })
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              gte(tasks.taskDate, startDate),
              lte(tasks.taskDate, endDate)
            )
          ),
        db
          .select({ logDate: habitLogs.logDate, habitId: habitLogs.habitId })
          .from(habitLogs)
          .where(
            and(
              eq(habitLogs.userId, userId),
              gte(habitLogs.logDate, startDate),
              lte(habitLogs.logDate, endDate)
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
              gte(journalEntries.entryDate, startDate),
              lte(journalEntries.entryDate, endDate)
            )
          ),
        db
          .select({ logDate: workoutLogs.logDate })
          .from(workoutLogs)
          .where(
            and(
              eq(workoutLogs.userId, userId),
              gte(workoutLogs.logDate, startDate),
              lte(workoutLogs.logDate, endDate)
            )
          ),
        db
          .select({
            startedAt: focusSessions.startedAt,
            durationMinutes: focusSessions.durationMinutes,
            status: focusSessions.status,
          })
          .from(focusSessions)
          .where(
            and(
              eq(focusSessions.userId, userId),
              gte(focusSessions.startedAt, new Date(`${startDate}T00:00:00`)),
              lte(focusSessions.startedAt, new Date(`${endDate}T23:59:59`)),
              inArray(focusSessions.status, ["completed", "active"])
            )
          ),
      ]);

    // Build habit color map
    const habitMap = new Map<string, { color: string; targetDays: number[] }>();
    for (const h of habitRows) {
      habitMap.set(h.id, { color: h.color, targetDays: h.targetDays ?? [] });
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

    for (const t of taskRows) {
      const day = ensureDay(t.taskDate);
      day.tasks.total++;
      if (t.done) day.tasks.done++;
      if (t.priority?.startsWith("A")) day.tasks.hasA = true;
      else if (t.priority?.startsWith("B")) day.tasks.hasB = true;
      else if (t.priority?.startsWith("C")) day.tasks.hasC = true;
    }

    for (const hl of habitLogRows) {
      const day = ensureDay(hl.logDate);
      day.habits.completed++;
      const habit = habitMap.get(hl.habitId);
      if (habit && !day.habits.colors.includes(habit.color)) {
        day.habits.colors.push(habit.color);
      }
    }

    for (const date of gridDates) {
      const d = new Date(date + "T00:00:00");
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      let expectedCount = 0;
      for (const [, habit] of habitMap) {
        if (habit.targetDays.includes(dow)) expectedCount++;
      }
      if (expectedCount > 0) {
        const day = ensureDay(date);
        day.habits.total = expectedCount;
      }
    }

    for (const j of journalRows) {
      const day = ensureDay(j.entryDate);
      day.journal.hasEntry = true;
      day.journal.mood = j.mood;
    }

    for (const w of workoutRows) {
      const day = ensureDay(w.logDate);
      day.workouts.count++;
    }

    for (const f of focusRows) {
      const date = f.startedAt.toISOString().split("T")[0];
      const day = ensureDay(date);
      day.focus.sessions++;
      day.focus.minutes += f.durationMinutes ?? 0;
    }

    return NextResponse.json({ summaries, gridDates });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
