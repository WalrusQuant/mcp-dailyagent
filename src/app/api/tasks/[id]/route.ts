import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeTask, maybeSpawnNextOccurrence } from "@/lib/mcp/queries/tasks";
import { readJsonBody } from "@/lib/api-body";

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

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.priority !== undefined && (typeof body.priority !== "string" || !/^[A-C][1-9]$/.test(body.priority as string))) {
    return NextResponse.json({ error: "Invalid priority: must match A1-C9" }, { status: 400 });
  }

  if (body.task_date !== undefined && (typeof body.task_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.task_date as string))) {
    return NextResponse.json({ error: "task_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (body.recurrence !== undefined && body.recurrence !== null) {
    const rec = body.recurrence as Record<string, unknown>;
    const validTypes = new Set(["daily", "weekdays", "weekly", "monthly"]);
    if (typeof rec !== "object" || Array.isArray(rec) || !validTypes.has(rec.type as string)) {
      return NextResponse.json(
        { error: "recurrence.type must be one of: daily, weekdays, weekly, monthly" },
        { status: 400 }
      );
    }
  }

  const allowedFields: Partial<typeof tasks.$inferInsert> = {};

  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.notes === "string" || body.notes === null) allowedFields.notes = body.notes as string | null;
  if (typeof body.priority === "string") allowedFields.priority = body.priority;
  if (typeof body.sort_order === "number") allowedFields.sortOrder = body.sort_order;
  if (typeof body.done === "boolean") allowedFields.done = body.done;
  if (typeof body.done_at === "string" || body.done_at === null) allowedFields.doneAt = body.done_at ? new Date(body.done_at as string) : null;
  if (typeof body.task_date === "string") allowedFields.taskDate = body.task_date;
  if (typeof body.space_id === "string" || body.space_id === null) allowedFields.spaceId = body.space_id as string | null;
  if (typeof body.goal_id === "string" || body.goal_id === null) allowedFields.goalId = body.goal_id as string | null;
  if (body.recurrence !== undefined) allowedFields.recurrence = body.recurrence as object | null;

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

  try {
    let wasAlreadyDone = false;
    if (body.done === true) {
      const [prior] = await db
        .select({ done: tasks.done })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
      wasAlreadyDone = prior?.done ?? false;
    }

    let row: typeof tasks.$inferSelect | null = null;

    if (typeof body.expected_updated_at === "string") {
      const result = await updateWithVersion<typeof tasks.$inferSelect>({
        table: tasks,
        id,
        userId,
        expectedUpdatedAt: body.expected_updated_at,
        patch: allowedFields,
      });
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
        return conflictResponse(serializeTask(result.current));
      }
      row = result.row;
    } else {
      allowedFields.updatedAt = new Date();
      [row] = await db
        .update(tasks)
        .set(allowedFields)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .returning();
    }

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If marking done and task has recurrence, create next occurrence
    if (body.done === true) {
      await maybeSpawnNextOccurrence(userId, row, wasAlreadyDone);
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
