import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, habitLogs, habits, journalEntries, workoutLogs, focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import type { DayDetail } from "@/components/calendar/types";
import { getUserId } from "@/lib/auth";
import { calendarDateSchema } from "@/lib/validation";
import { resolveDateContext, zonedDayRange } from "@/lib/date-context";
import { getDayOfWeek } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const date = request.nextUrl.searchParams.get("date");
  const parsedDate = calendarDateSchema.safeParse(date);
  if (!parsedDate.success) {
    return NextResponse.json({ error: "Invalid date parameter (YYYY-MM-DD)" }, { status: 400 });
  }
  const validDate = parsedDate.data;
  const dateContext = await resolveDateContext(userId);
  const focusRange = zonedDayRange(validDate, dateContext.timezone);

  try {
    const [taskRows, habitLogRows, journalRow, workoutRows, focusRows, allHabitRows] =
      await Promise.all([
        db
          .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, done: tasks.done })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, validDate)))
          .orderBy(tasks.sortOrder),
        db
          .select({ habitId: habitLogs.habitId })
          .from(habitLogs)
          .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, validDate))),
        db
          .select({ id: journalEntries.id, mood: journalEntries.mood, content: journalEntries.content })
          .from(journalEntries)
          .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, validDate)))
          .limit(1),
        db
          .select({ id: workoutLogs.id, name: workoutLogs.name, durationMinutes: workoutLogs.durationMinutes })
          .from(workoutLogs)
          .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, validDate)))
          .orderBy(workoutLogs.createdAt),
        db
          .select({
            id: focusSessions.id,
            durationMinutes: focusSessions.durationMinutes,
            taskId: focusSessions.taskId,
            status: focusSessions.status,
          })
          .from(focusSessions)
          .where(
            and(
              eq(focusSessions.userId, userId),
              gte(focusSessions.startedAt, focusRange.start),
              lt(focusSessions.startedAt, focusRange.end),
              inArray(focusSessions.status, ["completed", "active"])
            )
          )
          .orderBy(focusSessions.startedAt),
        db
          .select({ id: habits.id, name: habits.name, color: habits.color, targetDays: habits.targetDays })
          .from(habits)
          .where(and(eq(habits.userId, userId), eq(habits.archived, false))),
      ]);

    const dow = getDayOfWeek(validDate);

    const completedHabitIds = new Set(habitLogRows.map((hl) => hl.habitId));

    const habitsSummary = allHabitRows
      .filter((h) => (h.targetDays ?? []).includes(dow))
      .map((h) => ({
        name: h.name,
        color: h.color,
        completed: completedHabitIds.has(h.id),
      }));

    // Get task titles for focus sessions that have a task_id
    const focusTaskIds = focusRows
      .filter((f) => f.taskId)
      .map((f) => f.taskId as string);

    const focusTaskMap = new Map<string, string>();
    if (focusTaskIds.length > 0) {
      const focusTaskRows = await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.id, focusTaskIds));
      for (const t of focusTaskRows) {
        focusTaskMap.set(t.id, t.title);
      }
    }

    const detail: DayDetail = {
      date: validDate,
      tasks: taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        done: t.done,
      })),
      habits: habitsSummary,
      journal: journalRow[0]
        ? {
            id: journalRow[0].id,
            mood: journalRow[0].mood,
            content: journalRow[0].content,
          }
        : null,
      workouts: workoutRows.map((w) => ({
        id: w.id,
        name: w.name,
        duration_minutes: w.durationMinutes,
      })),
      focus: focusRows.map((f) => ({
        id: f.id,
        duration_minutes: f.durationMinutes,
        task_title: f.taskId ? (focusTaskMap.get(f.taskId) ?? null) : null,
        status: f.status,
      })),
    };

    return NextResponse.json(detail);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
