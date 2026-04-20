import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, lt, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeTask(t: typeof tasks.$inferSelect) {
  return {
    id: t.id,
    user_id: t.userId,
    title: t.title,
    notes: t.notes,
    priority: t.priority,
    sort_order: t.sortOrder,
    done: t.done,
    done_at: t.doneAt,
    task_date: t.taskDate,
    rolled_from: t.rolledFrom,
    space_id: t.spaceId,
    goal_id: t.goalId,
    recurrence: t.recurrence,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const spaceId = searchParams.get("space_id");

  const today = new Date().toISOString().split("T")[0];
  const taskDate = dateParam || today;

  try {
    let rows;

    if (taskDate === today) {
      // Today: also include incomplete tasks from previous days
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

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { title, notes, priority, task_date, space_id, goal_id, recurrence, sort_order } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title,
        notes: notes || null,
        priority: typeof priority === "string" ? priority : "B1",
        taskDate: task_date || today,
        spaceId: space_id || null,
        goalId: goal_id || null,
        recurrence: recurrence || null,
        sortOrder: typeof sort_order === "number" ? sort_order : 0,
      })
      .returning();

    return NextResponse.json(serializeTask(row));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
