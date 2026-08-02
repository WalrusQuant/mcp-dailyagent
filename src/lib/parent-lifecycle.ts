import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { goalProgressLogs, goals, habitLogs, habits, spaces, tasks } from "@/lib/db/schema";
import { getProfileToday } from "@/lib/date-context";

export interface ActiveLinkedCounts {
  tasks: number;
  habits: number;
}

export class ParentLifecycleError extends Error {
  constructor(
    public readonly code: "not_found" | "conflict" | "invalid_expected_updated_at",
    message: string,
    public readonly current?: typeof goals.$inferSelect | typeof spaces.$inferSelect
  ) {
    super(message);
    this.name = "ParentLifecycleError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function activeGoalLinks(tx: Tx, userId: string, goalId: string): Promise<ActiveLinkedCounts> {
  const [taskRows, habitRows] = await Promise.all([
    tx.select({ value: count() }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.goalId, goalId), eq(tasks.done, false))),
    tx.select({ value: count() }).from(habits).where(and(eq(habits.userId, userId), eq(habits.goalId, goalId), eq(habits.archived, false))),
  ]);
  return { tasks: taskRows[0]?.value ?? 0, habits: habitRows[0]?.value ?? 0 };
}

async function activeSpaceLinks(tx: Tx, userId: string, spaceId: string): Promise<ActiveLinkedCounts> {
  const rows = await tx
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.spaceId, spaceId), eq(tasks.done, false)));
  return { tasks: rows[0]?.value ?? 0, habits: 0 };
}

async function recomputeAutomaticGoal(tx: Tx, userId: string, goalId: string, today: string): Promise<number> {
  const [taskRows, habitRows, logs] = await Promise.all([
    tx.select({ done: tasks.done }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.goalId, goalId))),
    tx.select({ id: habits.id }).from(habits).where(and(eq(habits.userId, userId), eq(habits.goalId, goalId), eq(habits.archived, false))),
    tx.select({ habitId: habitLogs.habitId }).from(habitLogs).where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, today))),
  ]);
  const completedHabits = new Set(logs.map((row) => row.habitId));
  const taskProgress = taskRows.length ? Math.round(taskRows.filter((row) => row.done).length / taskRows.length * 100) : null;
  const habitProgress = habitRows.length ? Math.round(habitRows.filter((row) => completedHabits.has(row.id)).length / habitRows.length * 100) : null;
  if (taskProgress !== null && habitProgress !== null) return Math.round((taskProgress + habitProgress) / 2);
  return taskProgress ?? habitProgress ?? 0;
}

function parseExpected(value?: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ParentLifecycleError("invalid_expected_updated_at", "Invalid expected_updated_at");
  return parsed;
}

export async function transitionGoal(
  userId: string,
  goalId: string,
  status: "active" | "completed" | "abandoned",
  expectedUpdatedAt?: string,
  patch: Partial<typeof goals.$inferInsert> = {}
) {
  // Resolve outside the transaction: the test/production pool may reserve a
  // single connection for the transaction, so a nested global query can deadlock.
  const today = await getProfileToday(userId);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
    if (!existing) throw new ParentLifecycleError("not_found", "Goal not found");
    const expected = parseExpected(expectedUpdatedAt);
    if (expected && existing.updatedAt.getTime() !== expected.getTime()) throw new ParentLifecycleError("conflict", "Goal was modified", existing);

    const linked = await activeGoalLinks(tx, userId, goalId);
    const progressMode = patch.progressMode ?? existing.progressMode;
    let progress = typeof patch.progress === "number" ? patch.progress : existing.progress;
    if (status === "completed") progress = 100;
    else if (status === "active" && progressMode === "auto") progress = await recomputeAutomaticGoal(tx, userId, goalId, today);

    const [row] = await tx.update(goals).set({
      ...patch,
      status,
      progress,
      completedAt: status === "completed" ? new Date() : null,
      updatedAt: new Date(),
    }).where(and(eq(goals.id, goalId), eq(goals.userId, userId), ...(expected ? [eq(goals.updatedAt, expected)] : []))).returning();
    if (!row) throw new ParentLifecycleError("conflict", "Goal was modified", existing);

    if (status === "completed" || (status === "active" && progressMode === "auto") || typeof patch.progress === "number") {
      await tx.insert(goalProgressLogs).values({ goalId, userId, logDate: today, progress }).onConflictDoUpdate({
        target: [goalProgressLogs.goalId, goalProgressLogs.logDate], set: { progress },
      });
    }
    return { row, active_linked: linked };
  });
}

export async function transitionSpace(
  userId: string,
  spaceId: string,
  status: "active" | "paused" | "completed",
  expectedUpdatedAt?: string,
  patch: Partial<typeof spaces.$inferInsert> = {}
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId))).limit(1);
    if (!existing) throw new ParentLifecycleError("not_found", "Space not found");
    const expected = parseExpected(expectedUpdatedAt);
    if (expected && existing.updatedAt.getTime() !== expected.getTime()) throw new ParentLifecycleError("conflict", "Space was modified", existing);
    const linked = await activeSpaceLinks(tx, userId, spaceId);
    const [row] = await tx.update(spaces).set({ ...patch, status, updatedAt: new Date() }).where(and(
      eq(spaces.id, spaceId), eq(spaces.userId, userId), ...(expected ? [eq(spaces.updatedAt, expected)] : [])
    )).returning();
    if (!row) throw new ParentLifecycleError("conflict", "Space was modified", existing);
    return { row, active_linked: linked };
  });
}
