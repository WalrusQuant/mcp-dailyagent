import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeTask(t: typeof tasks.$inferSelect) {
  return {
    id: t.id,
    user_id: t.userId,
    title: t.title,
    notes: t.notes,
    priority: t.priority,
    sort_order: t.sortOrder,
    done: t.done,
    done_at: t.doneAt,
    task_date: t.taskDate,
    rolled_from: t.rolledFrom,
    space_id: t.spaceId,
    goal_id: t.goalId,
    recurrence: t.recurrence,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export async function POST(_request: NextRequest) {
  void _request;
  const userId = getUserId();

  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const undoneTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          lt(tasks.taskDate, todayStr),
          eq(tasks.done, false),
          isNull(tasks.rolledFrom)
        )
      );

    if (undoneTasks.length === 0) {
      return NextResponse.json([]);
    }

    const created = await db
      .insert(tasks)
      .values(
        undoneTasks.map((task) => ({
          userId,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          taskDate: todayStr,
          spaceId: task.spaceId,
          recurrence: task.recurrence,
          sortOrder: task.sortOrder,
          rolledFrom: task.id,
        }))
      )
      .returning();

    // Mark originals as done so they don't show up in future rollover checks
    const originalIds = undoneTasks.map((t) => t.id);
    for (const oid of originalIds) {
      await db.update(tasks).set({ done: true }).where(eq(tasks.id, oid));
    }

    return NextResponse.json(created.map(serializeTask));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
