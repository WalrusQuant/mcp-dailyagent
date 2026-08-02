import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, habitLogs, focusSessions, workoutLogs } from "@/lib/db/schema";
import { eq, and, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { endOfWeek } from "@/lib/dates";
import { calendarDateSchema } from "@/lib/validation";
import { resolveDateContext, zonedDateRange } from "@/lib/date-context";

/**
 * Week-scoped aggregates for the Weekly Review page.
 * Query: ?week=YYYY-MM-DD (Monday start preferred; any day in week is normalized via endOfWeek).
 */
export async function GET(request: NextRequest) {
  const userId = getUserId();
  const weekParam = new URL(request.url).searchParams.get("week");

  const parsedWeek = calendarDateSchema.safeParse(weekParam);
  if (!parsedWeek.success) {
    return NextResponse.json(
      { error: "week query parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Treat provided day as within the week; use startOfWeek semantics from client
  // (client already sends Monday). Bound is inclusive Mon–Sun.
  const weekStart = parsedWeek.data;
  const weekEnd = endOfWeek(weekStart);
  const dateContext = await resolveDateContext(userId);
  const focusRange = zonedDateRange(weekStart, weekEnd, dateContext.timezone);

  try {
    const [taskRows, habitCountRows, focusRows, workoutRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(*) filter (where ${tasks.done} = true)::int`,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            gte(tasks.taskDate, weekStart),
            lte(tasks.taskDate, weekEnd)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, userId),
            gte(habitLogs.logDate, weekStart),
            lte(habitLogs.logDate, weekEnd)
          )
        ),
      db
        .select({
          durationMinutes: focusSessions.durationMinutes,
          startedAt: focusSessions.startedAt,
          completedAt: focusSessions.completedAt,
          status: focusSessions.status,
        })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            inArray(focusSessions.status, ["completed", "active", "paused"]),
            gte(focusSessions.startedAt, focusRange.start),
            lt(focusSessions.startedAt, focusRange.end)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workoutLogs)
        .where(
          and(
            eq(workoutLogs.userId, userId),
            gte(workoutLogs.logDate, weekStart),
            lte(workoutLogs.logDate, weekEnd)
          )
        ),
    ]);

    let focusMinutes = 0;
    let focusSessionsCompleted = 0;
    for (const s of focusRows) {
      if (s.status === "completed") {
        focusSessionsCompleted += 1;
        focusMinutes += s.durationMinutes ?? 0;
      }
    }

    return NextResponse.json({
      week_start: weekStart,
      week_end: weekEnd,
      tasks_total: taskRows[0]?.total ?? 0,
      tasks_done: taskRows[0]?.done ?? 0,
      habit_logs: habitCountRows[0]?.count ?? 0,
      focus_minutes: focusMinutes,
      focus_sessions: focusSessionsCompleted,
      workouts: workoutRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
