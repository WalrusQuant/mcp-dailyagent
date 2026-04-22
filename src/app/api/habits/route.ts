import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeHabit } from "@/lib/mcp/queries/habits";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "true";

  try {
    const conditions = includeArchived
      ? eq(habits.userId, userId)
      : and(eq(habits.userId, userId), eq(habits.archived, false));

    const rows = await db
      .select()
      .from(habits)
      .where(conditions)
      .orderBy(asc(habits.sortOrder));

    return NextResponse.json(rows.map(serializeHabit));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { name, description, frequency, target_days, color, sort_order, goal_id } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(habits)
      .values({
        userId,
        name: name.trim(),
        ...(description ? { description } : {}),
        ...(frequency ? { frequency } : {}),
        ...(target_days ? { targetDays: target_days } : {}),
        ...(color ? { color } : {}),
        ...(typeof sort_order === "number" ? { sortOrder: sort_order } : {}),
        ...(goal_id !== undefined ? { goalId: goal_id || null } : {}),
      })
      .returning();

    return NextResponse.json(serializeHabit(row), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
