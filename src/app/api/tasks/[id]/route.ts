import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

function getNextOccurrence(taskDate: string, recurrence: { type: string; days?: number[] }): string {
  const d = new Date(taskDate + "T00:00:00");
  switch (recurrence.type) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekdays": {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      break;
    }
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeTask(rows[0]));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await request.json();

  const allowedFields: Partial<typeof tasks.$inferInsert> = {};

  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.notes === "string" || body.notes === null) allowedFields.notes = body.notes;
  if (typeof body.priority === "string") allowedFields.priority = body.priority;
  if (typeof body.sort_order === "number") allowedFields.sortOrder = body.sort_order;
  if (typeof body.done === "boolean") allowedFields.done = body.done;
  if (typeof body.done_at === "string" || body.done_at === null) allowedFields.doneAt = body.done_at ? new Date(body.done_at) : null;
  if (typeof body.task_date === "string") allowedFields.taskDate = body.task_date;
  if (typeof body.space_id === "string" || body.space_id === null) allowedFields.spaceId = body.space_id;
  if (typeof body.goal_id === "string" || body.goal_id === null) allowedFields.goalId = body.goal_id;
  if (body.recurrence !== undefined) allowedFields.recurrence = body.recurrence;

  // Auto-set doneAt when marking done
  if (body.done === true && body.done_at === undefined) {
    allowedFields.doneAt = new Date();
  }
  if (body.done === false) {
    allowedFields.doneAt = null;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updatedAt = new Date();

  try {
    const [row] = await db
      .update(tasks)
      .set(allowedFields)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If marking done and task has recurrence, create next occurrence
    if (body.done === true && row.recurrence && row.taskDate) {
      const recurrence = row.recurrence as { type: string; days?: number[] };
      const nextDate = getNextOccurrence(row.taskDate, recurrence);

      await db.insert(tasks).values({
        userId,
        title: row.title,
        notes: row.notes,
        priority: row.priority,
        taskDate: nextDate,
        spaceId: row.spaceId,
        recurrence: row.recurrence,
        sortOrder: row.sortOrder,
      });
    }

    return NextResponse.json(serializeTask(row));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
