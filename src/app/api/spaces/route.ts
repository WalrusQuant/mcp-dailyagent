import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeSpace } from "@/lib/mcp/queries/spaces";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const conditions =
      status && ["active", "paused", "completed"].includes(status)
        ? and(eq(spaces.userId, userId), eq(spaces.status, status as "active" | "paused" | "completed"))
        : eq(spaces.userId, userId);

    const rows = await db
      .select()
      .from(spaces)
      .where(conditions)
      .orderBy(desc(spaces.updatedAt));

    return NextResponse.json(rows.map(serializeSpace));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { name, description, status, deadline } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(spaces)
      .values({
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "active",
        deadline: deadline || null,
      })
      .returning();

    return NextResponse.json(serializeSpace(row));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
