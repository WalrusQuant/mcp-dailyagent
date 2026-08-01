import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeTask, maybeSpawnNextOccurrence } from "@/lib/mcp/queries/tasks";
import { getTagsForTask } from "@/lib/mcp/queries/tags";
import { readJsonBody } from "@/lib/api-body";
import { calendarDateSchema, recurrenceSchema, uuidSchema } from "@/lib/validation";
import { TaskMutationError, updateTaskAggregate } from "@/lib/tasks/mutations";

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

    const taskTagsList = await getTagsForTask(id);
    return NextResponse.json({ ...serializeTask(rows[0]), tags: taskTagsList });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

  if (body.task_date !== undefined && !calendarDateSchema.safeParse(body.task_date).success) {
    return NextResponse.json({ error: "task_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (body.recurrence !== undefined && body.recurrence !== null) {
    if (!recurrenceSchema.safeParse(body.recurrence).success) {
      return NextResponse.json(
        { error: "Invalid recurrence rule" },
        { status: 400 }
      );
    }
  }

  for (const field of ["space_id", "goal_id"] as const) {
    const value = body[field];
    if (value !== undefined && value !== null && !uuidSchema.safeParse(value).success) {
      return NextResponse.json({ error: `${field} must be a valid UUID` }, { status: 400 });
    }
  }
  if (
    body.tag_ids !== undefined &&
    (!Array.isArray(body.tag_ids) || body.tag_ids.some((id) => !uuidSchema.safeParse(id).success))
  ) {
    return NextResponse.json({ error: "tag_ids must be an array of UUIDs" }, { status: 400 });
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

  const hasTagUpdate = Array.isArray(body.tag_ids);
  if (Object.keys(allowedFields).length === 0 && !hasTagUpdate) {
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

    const result = await updateTaskAggregate(userId, id, {
      patch: allowedFields,
      tagIds: hasTagUpdate ? (body.tag_ids as string[]) : undefined,
      expectedUpdatedAt: typeof body.expected_updated_at === "string" ? body.expected_updated_at : undefined,
    });

    if (body.done === true) {
      await maybeSpawnNextOccurrence(userId, result.task, wasAlreadyDone);
    }
    return NextResponse.json({ ...serializeTask(result.task), tags: result.tags });
  } catch (err) {
    if (err instanceof TaskMutationError) {
      if (err.code === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (err.code === "invalid_expected_updated_at") {
        return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
      }
      if (err.code === "conflict" && err.current) return conflictResponse(serializeTask(err.current));
      if (err.code === "relationship_not_found") {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
