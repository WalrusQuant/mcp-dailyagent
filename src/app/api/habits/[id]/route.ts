import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeHabit } from "@/lib/mcp/queries/habits";

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
    if (typeof body.expected_updated_at === "string") {
      const result = await updateWithVersion<typeof habits.$inferSelect>({
        table: habits,
        id,
        userId,
        expectedUpdatedAt: body.expected_updated_at,
        patch: allowedFields,
      });
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
        return conflictResponse(serializeHabit(result.current));
      }
      return NextResponse.json(serializeHabit(result.row));
    }

    allowedFields.updatedAt = new Date();
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
