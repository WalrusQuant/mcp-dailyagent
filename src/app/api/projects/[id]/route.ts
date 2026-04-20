import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeSpace(s: typeof spaces.$inferSelect) {
  return {
    id: s.id,
    user_id: s.userId,
    name: s.name,
    description: s.description,
    status: s.status,
    progress: s.progress,
    deadline: s.deadline,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
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
      .from(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeSpace(rows[0]));
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

  const allowedFields: Partial<typeof spaces.$inferInsert> = {};
  if (typeof body.name === "string") allowedFields.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;
  if (typeof body.status === "string" && ["active", "paused", "completed"].includes(body.status))
    allowedFields.status = body.status as "active" | "paused" | "completed";
  if (typeof body.progress === "number" && body.progress >= 0 && body.progress <= 100)
    allowedFields.progress = body.progress;
  if (typeof body.deadline === "string" || body.deadline === null)
    allowedFields.deadline = body.deadline;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updatedAt = new Date();

  try {
    const [row] = await db
      .update(spaces)
      .set(allowedFields)
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeSpace(row));
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
    await db.delete(spaces).where(and(eq(spaces.id, id), eq(spaces.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
