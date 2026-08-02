import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { focusSessions, tasks } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { resolveDateContext, zonedDate, zonedDateRange } from "@/lib/date-context";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  if (daysParam !== null) {
    const parsed = parseInt(daysParam, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return NextResponse.json({ error: "Invalid days parameter" }, { status: 400 });
    }
  }
  const days = Math.max(1, parseInt(daysParam ?? "7", 10));

  const dateContext = await resolveDateContext(userId);
  const firstDay = addDays(dateContext.today, -(days - 1));
  const range = zonedDateRange(firstDay, dateContext.today, dateContext.timezone);

  try {
    const sessions = await db
      .select({
        id: focusSessions.id,
        durationMinutes: focusSessions.durationMinutes,
        startedAt: focusSessions.startedAt,
        status: focusSessions.status,
        taskId: focusSessions.taskId,
      })
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startedAt, range.start),
          lt(focusSessions.startedAt, range.end)
        )
      )
      .orderBy(focusSessions.startedAt);

    const completedSessions = sessions.filter((s) => s.status === "completed");

    const totalSessions = completedSessions.length;
    const totalMinutes = completedSessions.reduce(
      (sum, s) => sum + (s.durationMinutes ?? 0),
      0
    );

    // Build daily breakdown
    const dailyMap = new Map<string, { sessions: number; minutes: number }>();
    for (let i = 0; i < days; i++) {
      dailyMap.set(addDays(firstDay, i), { sessions: 0, minutes: 0 });
    }

    for (const s of completedSessions) {
      const key = zonedDate(s.startedAt, dateContext.timezone);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.sessions += 1;
        entry.minutes += s.durationMinutes ?? 0;
      }
    }

    const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      sessions: v.sessions,
      minutes: v.minutes,
    }));

    // Top tasks by session count
    const taskSessionCounts = new Map<string, number>();
    for (const s of completedSessions) {
      if (s.taskId) {
        taskSessionCounts.set(s.taskId, (taskSessionCounts.get(s.taskId) ?? 0) + 1);
      }
    }

    const taskIds = Array.from(taskSessionCounts.keys());
    let topTasks: Array<{ taskTitle: string; sessions: number }> = [];

    if (taskIds.length > 0) {
      const taskRows = await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(and(inArray(tasks.id, taskIds), eq(tasks.userId, userId)));

      topTasks = taskRows
        .map((t) => ({
          taskTitle: t.title,
          sessions: taskSessionCounts.get(t.id) ?? 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 5);
    }

    return NextResponse.json({
      totalSessions,
      totalMinutes,
      dailyBreakdown,
      topTasks,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
