import { db } from "@/lib/db/client";
import { goals, goalProgressLogs } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "active" | "completed" | "abandoned";
  progress: number;
  progress_mode: string | null;
  target_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category?: string;
  target_date?: string;
  progress_mode?: string;
}

export interface UpdateGoalFields {
  title?: string;
  description?: string | null;
  status?: string;
  progress?: number;
  target_date?: string | null;
}

function rowToGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    description: row.description ?? null,
    category: row.category ?? null,
    status: row.status as "active" | "completed" | "abandoned",
    progress: row.progress,
    progress_mode: row.progressMode ?? null,
    target_date: row.targetDate ?? null,
    sort_order: row.sortOrder,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getGoals(
  userId: string,
  status = "active"
): Promise<QueryResult<Goal[]>> {
  try {
    const rows =
      status !== "all"
        ? await db
            .select()
            .from(goals)
            .where(
              and(
                eq(goals.userId, userId),
                eq(goals.status, status as "active" | "completed" | "abandoned")
              )
            )
            .orderBy(asc(goals.sortOrder), desc(goals.createdAt))
        : await db
            .select()
            .from(goals)
            .where(eq(goals.userId, userId))
            .orderBy(asc(goals.sortOrder), desc(goals.createdAt));

    return { data: rows.map(rowToGoal), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createGoal(
  userId: string,
  input: CreateGoalInput
): Promise<QueryResult<Goal>> {
  try {
    const [row] = await db
      .insert(goals)
      .values({
        userId,
        title: input.title.trim(),
        ...(input.description ? { description: input.description } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.target_date ? { targetDate: input.target_date } : {}),
        ...(input.progress_mode ? { progressMode: input.progress_mode } : {}),
      })
      .returning();

    return { data: rowToGoal(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateGoal(
  userId: string,
  goalId: string,
  fields: UpdateGoalFields
): Promise<QueryResult<Goal>> {
  try {
    const updates: Partial<typeof goals.$inferInsert> = {};

    if (typeof fields.title === "string") updates.title = fields.title;
    if (typeof fields.description === "string" || fields.description === null)
      updates.description = fields.description;
    if (typeof fields.status === "string") {
      updates.status = fields.status as "active" | "completed" | "abandoned";
      if (fields.status === "completed") {
        updates.completedAt = new Date();
      } else if (fields.status === "active") {
        updates.completedAt = null;
      }
    }
    if (typeof fields.progress === "number") updates.progress = fields.progress;
    if (typeof fields.target_date === "string" || fields.target_date === null)
      updates.targetDate = fields.target_date;

    updates.updatedAt = new Date();

    const [row] = await db
      .update(goals)
      .set(updates)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Goal not found" };
    return { data: rowToGoal(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function logGoalProgress(
  userId: string,
  goalId: string,
  progress: number
): Promise<QueryResult<Goal>> {
  try {
    const today = getToday();

    const goal = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(goals)
        .set({ progress, updatedAt: new Date() })
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
        .returning();

      if (!updated) return null;

      await tx
        .insert(goalProgressLogs)
        .values({ goalId, userId, logDate: today, progress })
        .onConflictDoUpdate({
          target: [goalProgressLogs.goalId, goalProgressLogs.logDate],
          set: { progress },
        });

      return updated;
    });

    if (!goal) return { data: null, error: "Goal not found" };
    return { data: rowToGoal(goal), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
