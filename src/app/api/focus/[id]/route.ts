import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeSession } from "@/lib/mcp/queries/focus";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await request.json();

  const allowedFields: Partial<typeof focusSessions.$inferInsert> = {};

  if (typeof body.status === "string") {
    const validStatuses = ["active", "completed", "cancelled"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "status must be one of: active, completed, cancelled" },
        { status: 400 }
      );
    }
    allowedFields.status = body.status;

    if (body.status === "completed") {
      allowedFields.completedAt = body.completed_at ? new Date(body.completed_at) : new Date();
    }
  }

  if (typeof body.completed_at === "string") {
    allowedFields.completedAt = new Date(body.completed_at);
  }

  if (typeof body.notes === "string" || body.notes === null) {
    allowedFields.notes = body.notes;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    if (typeof body.expected_updated_at === "string") {
      const result = await updateWithVersion<typeof focusSessions.$inferSelect>({
        table: focusSessions,
        id,
        userId,
        expectedUpdatedAt: body.expected_updated_at,
        patch: allowedFields,
      });
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (result.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
        return conflictResponse(serializeSession(result.current));
      }
      return NextResponse.json(serializeSession(result.row));
    }

    allowedFields.updatedAt = new Date();
    const [row] = await db
      .update(focusSessions)
      .set(allowedFields)
      .where(and(eq(focusSessions.id, id), eq(focusSessions.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeSession(row));
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
    await db
      .delete(focusSessions)
      .where(and(eq(focusSessions.id, id), eq(focusSessions.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
