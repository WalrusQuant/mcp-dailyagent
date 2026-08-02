import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { updateWithVersion } from "@/lib/db/optimistic";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeSpace } from "@/lib/mcp/queries/spaces";
import { readJsonBody } from "@/lib/api-body";
import { ParentLifecycleError, transitionSpace } from "@/lib/parent-lifecycle";

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

  const allowedFields: Partial<typeof spaces.$inferInsert> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    allowedFields.name = trimmed;
  }
  if (typeof body.description === "string")
    allowedFields.description = body.description.trim();
  else if (body.description === null) allowedFields.description = null;
  if (typeof body.status === "string" && ["active", "paused", "completed"].includes(body.status))
    allowedFields.status = body.status as "active" | "paused" | "completed";
  if (typeof body.progress === "number" && body.progress >= 0 && body.progress <= 100)
    allowedFields.progress = body.progress;
  if (typeof body.deadline === "string" || body.deadline === null)
    allowedFields.deadline = body.deadline as string | null;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    let lifecycleCounts: { tasks: number; habits: number } | undefined;
    if (typeof allowedFields.status === "string") {
      const status = allowedFields.status as "active" | "paused" | "completed";
      delete allowedFields.status;
      const result = await transitionSpace(
        userId,
        id,
        status,
        typeof body.expected_updated_at === "string" ? body.expected_updated_at : undefined,
        allowedFields
      );
      lifecycleCounts = result.active_linked;
      return NextResponse.json({ ...serializeSpace(result.row), active_linked: lifecycleCounts });
    }
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
      return NextResponse.json({ ...serializeSpace(result.row), ...(lifecycleCounts ? { active_linked: lifecycleCounts } : {}) });
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

    return NextResponse.json({ ...serializeSpace(row), ...(lifecycleCounts ? { active_linked: lifecycleCounts } : {}) });
  } catch (err) {
    if (err instanceof ParentLifecycleError) {
      if (err.code === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (err.code === "invalid_expected_updated_at") return NextResponse.json({ error: err.message }, { status: 400 });
      return conflictResponse(serializeSpace(err.current as typeof spaces.$inferSelect));
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
    await db.delete(spaces).where(and(eq(spaces.id, id), eq(spaces.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
