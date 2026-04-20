import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tags } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeTag(t: typeof tags.$inferSelect) {
  return {
    id: t.id,
    user_id: t.userId,
    name: t.name,
    color: t.color,
    created_at: t.createdAt,
  };
}

export async function GET() {
  const userId = getUserId();

  try {
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name));

    return NextResponse.json(rows.map(serializeTag));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(tags)
      .values({
        userId,
        name: name.trim(),
        color: color || "#94a3b8",
      })
      .returning();

    return NextResponse.json(serializeTag(row));
  } catch (err) {
    // Unique constraint violation
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
