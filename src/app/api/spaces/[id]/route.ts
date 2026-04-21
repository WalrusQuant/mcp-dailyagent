import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";

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

  try {
    if (typeof body.expected_updated_at === "string") {
      const result = await updateWithVersion<typeof spaces.$inferSelect>({
        table: spaces,
        id,
        userId,
        expectedUpdatedAt: body.expected_updated_at,
        patch: allowedFields,
      });
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
        return conflictResponse(serializeSpace(result.current));
      }
      return NextResponse.json(serializeSpace(result.row));
    }

    allowedFields.updatedAt = new Date();
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
