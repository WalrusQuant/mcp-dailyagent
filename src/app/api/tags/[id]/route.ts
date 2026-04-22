import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTag } from "@/lib/mcp/queries/tags";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await request.json();
  const allowedFields: Partial<typeof tags.$inferInsert> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    allowedFields.name = trimmed;
  }
  if (typeof body.color === "string") allowedFields.color = body.color;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(tags)
      .set(allowedFields)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeTag(row));
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json({ error: "Tag name already exists" }, { status: 409 });
    }
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
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
