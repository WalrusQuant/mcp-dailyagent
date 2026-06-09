import { getToday } from "@/lib/dates";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTask } from "@/lib/mcp/queries/tasks";

/**
 * Moves every undone past-dated task to today in place. No copies are made
 * and nothing is marked done, so completion history stays truthful, goal
 * links survive, and a task that stays undone simply rolls again tomorrow.
 * rolled_from is set (to the task itself on first roll) so the UI can show
 * the "rolled over" badge.
 */
export async function POST(_request: NextRequest) {
  void _request;
  const userId = getUserId();

  const todayStr = getToday();

  try {
    const rolled = await db
      .update(tasks)
      .set({
        taskDate: todayStr,
        rolledFrom: sql`coalesce(${tasks.rolledFrom}, ${tasks.id})`,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.userId, userId), lt(tasks.taskDate, todayStr), eq(tasks.done, false)))
      .returning();

    return NextResponse.json(rolled.map(serializeTask));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
