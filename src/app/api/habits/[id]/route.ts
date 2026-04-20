import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeHabit(h: typeof habits.$inferSelect) {
  return {
    id: h.id,
    user_id: h.userId,
    name: h.name,
    description: h.description,
    frequency: h.frequency,
    target_days: h.targetDays,
    color: h.color,
    archived: h.archived,
    sort_order: h.sortOrder,
    goal_id: h.goalId,
    created_at: h.createdAt,
  };
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
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeHabit(rows[0]));
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

  const allowedFields: Partial<typeof habits.$inferInsert> = {};

  if (typeof body.name === "string") allowedFields.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;
  if (typeof body.frequency === "string" || body.frequency === null)
    allowedFields.frequency = body.frequency ?? undefined;
  if (Array.isArray(body.target_days) || body.target_days === null)
    allowedFields.targetDays = body.target_days;
  if (typeof body.color === "string" || body.color === null)
    allowedFields.color = body.color ?? undefined;
  if (typeof body.archived === "boolean")
    allowedFields.archived = body.archived;
  if (typeof body.sort_order === "number" || body.sort_order === null)
    allowedFields.sortOrder = body.sort_order ?? undefined;
  if (typeof body.goal_id === "string" || body.goal_id === null)
    allowedFields.goalId = body.goal_id;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(habits)
      .set(allowedFields)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeHabit(row));
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
    await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
