import { resolveDateContext } from "@/lib/date-context";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks, taskTags } from "@/lib/db/schema";
import { eq, and, or, lt, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTask } from "@/lib/mcp/queries/tasks";
import { getTagsByTaskIds } from "@/lib/mcp/queries/tags";
import { readJsonBody } from "@/lib/api-body";
import { calendarDateSchema, recurrenceSchema, uuidSchema } from "@/lib/validation";
import { createTaskAggregate, TaskMutationError } from "@/lib/tasks/mutations";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const spaceId = searchParams.get("space_id");
  const tagId = searchParams.get("tag_id");

  if (
    (dateParam !== null && !calendarDateSchema.safeParse(dateParam).success) ||
    (spaceId !== null && !uuidSchema.safeParse(spaceId).success) ||
    (tagId !== null && !uuidSchema.safeParse(tagId).success)
  ) {
    return NextResponse.json({ error: "Invalid task filters" }, { status: 400 });
  }

  const { today } = await resolveDateContext(userId);
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

    if (tagId) {
      const tagged = await db
        .select({ taskId: taskTags.taskId })
        .from(taskTags)
        .where(eq(taskTags.tagId, tagId));
      const allowed = new Set(tagged.map((t) => t.taskId));
      rows = rows.filter((r) => allowed.has(r.id));
    }

    const tagsMap = await getTagsByTaskIds(rows.map((r) => r.id));
    return NextResponse.json(
      rows.map((r) => ({
        ...serializeTask(r),
        tags: tagsMap.get(r.id) ?? [],
      }))
    );
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

  const { title, notes, priority, task_date, space_id, goal_id, recurrence, sort_order, tag_ids } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (priority !== undefined && (typeof priority !== "string" || !/^[A-C][1-9]$/.test(priority as string))) {
    return NextResponse.json({ error: "Invalid priority: must match A1-C9" }, { status: 400 });
  }

  if (task_date !== undefined && !calendarDateSchema.safeParse(task_date).success) {
    return NextResponse.json({ error: "task_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (recurrence !== undefined && recurrence !== null) {
    if (!recurrenceSchema.safeParse(recurrence).success) {
      return NextResponse.json(
        { error: "Invalid recurrence rule" },
        { status: 400 }
      );
    }
  }

  for (const [field, value] of [["space_id", space_id], ["goal_id", goal_id]] as const) {
    if (value !== undefined && value !== null && !uuidSchema.safeParse(value).success) {
      return NextResponse.json({ error: `${field} must be a valid UUID` }, { status: 400 });
    }
  }
  if (tag_ids !== undefined && (!Array.isArray(tag_ids) || tag_ids.some((id) => !uuidSchema.safeParse(id).success))) {
    return NextResponse.json({ error: "tag_ids must be an array of UUIDs" }, { status: 400 });
  }

  const { today } = await resolveDateContext(userId);

  try {
    const result = await createTaskAggregate(userId, {
      title: title as string,
      notes: (notes as string) || null,
      priority: typeof priority === "string" ? priority : "B1",
      taskDate: (task_date as string) || today,
      spaceId: (space_id as string) || null,
      goalId: (goal_id as string) || null,
      recurrence: recurrence !== undefined ? (recurrence as object | null) : null,
      sortOrder: typeof sort_order === "number" ? sort_order : 0,
      tagIds: Array.isArray(tag_ids) ? (tag_ids as string[]) : undefined,
    });
    return NextResponse.json(
      { ...serializeTask(result.task), tags: result.tags },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TaskMutationError && err.code === "relationship_not_found") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
