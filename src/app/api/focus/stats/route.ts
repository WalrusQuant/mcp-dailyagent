import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { focusSessions, tasks } from "@/lib/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "7"));

  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

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
          gte(focusSessions.startedAt, from)
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
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { sessions: 0, minutes: 0 });
    }

    for (const s of completedSessions) {
      const key = s.startedAt.toISOString().slice(0, 10);
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
