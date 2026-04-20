import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, lt, asc, sql } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  priority: string;
  task_date: string;
  space_id: string | null;
  goal_id: string | null;
  done: boolean;
  done_at: string | null;
  rolled_from: string | null;
  recurrence: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  priority?: string;
  task_date?: string;
  space_id?: string;
  goal_id?: string;
  recurrence?: unknown;
  sort_order?: number;
}

export interface UpdateTaskFields {
  title?: string;
  notes?: string | null;
  priority?: string;
  task_date?: string;
  space_id?: string | null;
  goal_id?: string | null;
  done?: boolean;
  sort_order?: number;
}

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    notes: row.notes ?? null,
    priority: row.priority,
    task_date: row.taskDate,
    space_id: row.spaceId ?? null,
    goal_id: row.goalId ?? null,
    done: row.done,
    done_at: row.doneAt ? row.doneAt.toISOString() : null,
    rolled_from: row.rolledFrom ?? null,
    recurrence: row.recurrence ?? null,
    sort_order: row.sortOrder,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getTasksForDate(
  _db: typeof db,
  userId: string,
  date?: string
): Promise<QueryResult<Task[]>> {
  try {
    const today = getToday();
    const taskDate = date || today;

    if (taskDate === today) {
      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            or(
              eq(tasks.taskDate, taskDate),
              and(lt(tasks.taskDate, taskDate), eq(tasks.done, false))
            )
          )
        )
        .orderBy(asc(tasks.priority), asc(tasks.sortOrder));

      return { data: rows.map(rowToTask), error: null };
    }

    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.taskDate, taskDate)))
      .orderBy(asc(tasks.priority), asc(tasks.sortOrder));

    return { data: rows.map(rowToTask), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getOverdueTasks(
  _db: typeof db,
  userId: string
): Promise<QueryResult<Task[]>> {
  try {
    const today = getToday();

    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.userId, userId), lt(tasks.taskDate, today), eq(tasks.done, false))
      )
      .orderBy(asc(tasks.priority), asc(tasks.sortOrder));

    return { data: rows.map(rowToTask), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createTask(
  _db: typeof db,
  userId: string,
  input: CreateTaskInput
): Promise<QueryResult<Task>> {
  try {
    const today = getToday();

    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title: input.title,
        notes: input.notes || null,
        priority: typeof input.priority === "string" ? input.priority : "B1",
        taskDate: input.task_date || today,
        spaceId: input.space_id || null,
        goalId: input.goal_id || null,
        recurrence: input.recurrence || null,
        sortOrder: typeof input.sort_order === "number" ? input.sort_order : 0,
      })
      .returning();

    return { data: rowToTask(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateTask(
  _db: typeof db,
  userId: string,
  taskId: string,
  fields: UpdateTaskFields
): Promise<QueryResult<Task>> {
  try {
    const updates: Partial<typeof tasks.$inferInsert> = {};

    if (typeof fields.title === "string") updates.title = fields.title;
    if (typeof fields.notes === "string" || fields.notes === null) updates.notes = fields.notes;
    if (typeof fields.priority === "string") updates.priority = fields.priority;
    if (typeof fields.task_date === "string") updates.taskDate = fields.task_date;
    if (typeof fields.space_id === "string" || fields.space_id === null)
      updates.spaceId = fields.space_id;
    if (typeof fields.goal_id === "string" || fields.goal_id === null)
      updates.goalId = fields.goal_id;
    if (typeof fields.done === "boolean") {
      updates.done = fields.done;
      updates.doneAt = fields.done ? new Date() : null;
    }
    if (typeof fields.sort_order === "number") updates.sortOrder = fields.sort_order;

    updates.updatedAt = new Date();

    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Task not found" };
    return { data: rowToTask(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function completeTask(
  _db: typeof db,
  userId: string,
  taskId: string
): Promise<QueryResult<Task>> {
  try {
    const [row] = await db
      .update(tasks)
      .set({ done: true, doneAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Task not found" };
    return { data: rowToTask(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteTask(
  _db: typeof db,
  userId: string,
  taskId: string
): Promise<QueryResult<{ success: boolean }>> {
  try {
    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    return { data: { success: true }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
