import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, lt, isNull, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTask } from "@/lib/mcp/queries/tasks";

export async function POST(_request: NextRequest) {
  void _request;
  const userId = getUserId();

  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const created = await db.transaction(async (tx) => {
      const undoneTasks = await tx
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

      if (undoneTasks.length === 0) return [];

      const inserted = await tx
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

      await tx
        .update(tasks)
        .set({ done: true, doneAt: new Date(), updatedAt: new Date() })
        .where(inArray(tasks.id, undoneTasks.map((t) => t.id)));

      return inserted;
    });

    return NextResponse.json(created.map(serializeTask));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
