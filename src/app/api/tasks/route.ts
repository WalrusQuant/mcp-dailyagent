import { getToday } from "@/lib/dates";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, lt, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTask } from "@/lib/mcp/queries/tasks";
import { readJsonBody } from "@/lib/api-body";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const spaceId = searchParams.get("space_id");

  const today = getToday();
  const taskDate = dateParam || today;

  try {
    let rows;

    if (taskDate === today) {
      const conditions = and(
        eq(tasks.userId, userId),
        or(eq(tasks.taskDate, taskDate), and(lt(tasks.taskDate, taskDate), eq(tasks.done, false))),
        spaceId ? eq(tasks.spaceId, spaceId) : undefined
      );
      rows = await db
        .select()
        .from(tasks)
        .where(conditions)
        .orderBy(asc(tasks.priority), asc(tasks.sortOrder));
    } else {
      const conditions = and(
        eq(tasks.userId, userId),
        eq(tasks.taskDate, taskDate),
        spaceId ? eq(tasks.spaceId, spaceId) : undefined
      );
      rows = await db
        .select()
        .from(tasks)
        .where(conditions)
        .orderBy(asc(tasks.priority), asc(tasks.sortOrder));
    }

    return NextResponse.json(rows.map(serializeTask));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

const VALID_RECURRENCE_TYPES = new Set(["daily", "weekdays", "weekly", "monthly"]);

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, notes, priority, task_date, space_id, goal_id, recurrence, sort_order } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (priority !== undefined && (typeof priority !== "string" || !/^[A-C][1-9]$/.test(priority as string))) {
    return NextResponse.json({ error: "Invalid priority: must match A1-C9" }, { status: 400 });
  }

  if (task_date !== undefined && (typeof task_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(task_date as string))) {
    return NextResponse.json({ error: "task_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (recurrence !== undefined && recurrence !== null) {
    const rec = recurrence as Record<string, unknown>;
    if (typeof rec !== "object" || Array.isArray(rec) || !VALID_RECURRENCE_TYPES.has(rec.type as string)) {
      return NextResponse.json(
        { error: "recurrence.type must be one of: daily, weekdays, weekly, monthly" },
        { status: 400 }
      );
    }
  }

  const today = getToday();

  try {
    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title: title as string,
        notes: (notes as string) || null,
        priority: typeof priority === "string" ? priority : "B1",
        taskDate: (task_date as string) || today,
        spaceId: (space_id as string) || null,
        goalId: (goal_id as string) || null,
        recurrence: recurrence !== undefined ? (recurrence as object | null) : null,
        sortOrder: typeof sort_order === "number" ? sort_order : 0,
      })
      .returning();

    return NextResponse.json(serializeTask(row));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
