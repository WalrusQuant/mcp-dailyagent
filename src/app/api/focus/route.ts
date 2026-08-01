import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeSession } from "@/lib/mcp/queries/focus";
import { readJsonBody } from "@/lib/api-body";
import { isOwned } from "@/lib/db/ownership";
import { isoTimestampSchema, isOrderedTimestampRange } from "@/lib/validation";
import { uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (
    (fromParam !== null && !isoTimestampSchema.safeParse(fromParam).success) ||
    (toParam !== null && !isoTimestampSchema.safeParse(toParam).success) ||
    !isOrderedTimestampRange(fromParam ?? undefined, toParam ?? undefined)
  ) {
    return NextResponse.json({ error: "Invalid timestamp or timestamp range" }, { status: 400 });
  }

  const from = fromParam ?? defaultFrom.toISOString();
  const to = toParam ?? new Date().toISOString();

  try {
    const rows = await db
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startedAt, new Date(from)),
          lte(focusSessions.startedAt, new Date(to))
        )
      )
      .orderBy(desc(focusSessions.startedAt));

    return NextResponse.json(rows.map(serializeSession));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { task_id, duration_minutes, break_minutes, notes } = body;

  if (typeof duration_minutes !== "number" || duration_minutes <= 0) {
    return NextResponse.json(
      { error: "duration_minutes must be a positive number" },
      { status: 400 }
    );
  }
  if (task_id !== undefined && task_id !== null && !uuidSchema.safeParse(task_id).success) {
    return NextResponse.json({ error: "task_id must be a valid UUID" }, { status: 400 });
  }

  try {
    if (typeof task_id === "string" && !(await isOwned("task", task_id, userId))) {
      return NextResponse.json({ error: "task_id must reference one of your tasks" }, { status: 400 });
    }

    const [row] = await db
      .insert(focusSessions)
      .values({
        userId,
        taskId: (task_id as string) ?? null,
        durationMinutes: duration_minutes,
        breakMinutes: typeof break_minutes === "number" ? break_minutes : 0,
        notes: (notes as string) ?? null,
        startedAt: new Date(),
        status: "active",
      })
      .returning();

    return NextResponse.json(serializeSession(row), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
