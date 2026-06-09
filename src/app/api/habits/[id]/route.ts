import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeHabit } from "@/lib/mcp/queries/habits";
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
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeHabit(rows[0]));
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

  const allowedFields: Partial<typeof habits.$inferInsert> = {};

  // NOT NULL columns: explicit null must return 400.
  if ("name" in body) {
    if (body.name === null) return NextResponse.json({ error: "name cannot be null" }, { status: 400 });
    if (typeof body.name === "string") allowedFields.name = body.name;
  }

  // Nullable column: explicit null clears the value.
  if ("description" in body) {
    if (typeof body.description === "string" || body.description === null)
      allowedFields.description = body.description as string | null;
  }

  if ("frequency" in body) {
    if (body.frequency === null) return NextResponse.json({ error: "frequency cannot be null" }, { status: 400 });
    if (typeof body.frequency === "string") allowedFields.frequency = body.frequency;
  }

  if ("target_days" in body) {
    if (body.target_days === null) return NextResponse.json({ error: "target_days cannot be null" }, { status: 400 });
    if (Array.isArray(body.target_days)) allowedFields.targetDays = body.target_days as number[];
  }

  if ("color" in body) {
    if (body.color === null) return NextResponse.json({ error: "color cannot be null" }, { status: 400 });
    if (typeof body.color === "string") allowedFields.color = body.color;
  }

  if ("archived" in body) {
    if (body.archived === null) return NextResponse.json({ error: "archived cannot be null" }, { status: 400 });
    if (typeof body.archived === "boolean") allowedFields.archived = body.archived;
  }

  if ("sort_order" in body) {
    if (body.sort_order === null) return NextResponse.json({ error: "sort_order cannot be null" }, { status: 400 });
    if (typeof body.sort_order === "number") allowedFields.sortOrder = body.sort_order;
  }

  // Nullable FK: explicit null clears the goal link.
  if ("goal_id" in body) {
    if (typeof body.goal_id === "string" || body.goal_id === null)
      allowedFields.goalId = body.goal_id as string | null;
  }

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
    await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
