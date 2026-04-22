import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { goals, tasks, habits } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeGoal } from "@/lib/mcp/queries/goals";
import { serializeTask } from "@/lib/mcp/queries/tasks";
import { serializeHabit } from "@/lib/mcp/queries/habits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const [goalRows, taskRows, habitRows] = await Promise.all([
      db
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, userId))),
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.goalId, id), eq(tasks.userId, userId)))
        .orderBy(asc(tasks.priority), asc(tasks.sortOrder)),
      db
        .select()
        .from(habits)
        .where(
          and(eq(habits.goalId, id), eq(habits.userId, userId), eq(habits.archived, false))
        )
        .orderBy(asc(habits.sortOrder)),
    ]);

    if (goalRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...serializeGoal(goalRows[0]),
      tasks: taskRows.map(serializeTask),
      habits: habitRows.map(serializeHabit),
    });
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
  const allowedFields: Partial<typeof goals.$inferInsert> = {};

  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;
  if (typeof body.category === "string") allowedFields.category = body.category;
  if (typeof body.status === "string") allowedFields.status = body.status as "active" | "completed" | "abandoned";
  if (typeof body.progress === "number") allowedFields.progress = body.progress;
  if (typeof body.progress_mode === "string") allowedFields.progressMode = body.progress_mode as "auto" | "manual";
  if (typeof body.target_date === "string" || body.target_date === null)
    allowedFields.targetDate = body.target_date;
  if (typeof body.sort_order === "number") allowedFields.sortOrder = body.sort_order;

  if (body.status === "completed") {
    allowedFields.completedAt = new Date();
  }
  if (body.status === "active") {
    allowedFields.completedAt = null;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    if (typeof body.expected_updated_at === "string") {
      const result = await updateWithVersion<typeof goals.$inferSelect>({
        table: goals,
        id,
        userId,
        expectedUpdatedAt: body.expected_updated_at,
        patch: allowedFields,
      });
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
        return conflictResponse(serializeGoal(result.current));
      }
      return NextResponse.json(serializeGoal(result.row));
    }

    allowedFields.updatedAt = new Date();
    const [row] = await db
      .update(goals)
      .set(allowedFields)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeGoal(row));
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
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
