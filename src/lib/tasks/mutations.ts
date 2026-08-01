import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tags, tasks, taskTags } from "@/lib/db/schema";
import { getToday } from "@/lib/dates";
import { serializeTag, type SerializedTag } from "@/lib/mcp/queries/tags";
import { isOwnedRelationship } from "@/lib/db/ownership";

export type TaskMutationErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_expected_updated_at"
  | "relationship_not_found";

export class TaskMutationError extends Error {
  constructor(
    public readonly code: TaskMutationErrorCode,
    message: string,
    public readonly current?: typeof tasks.$inferSelect
  ) {
    super(message);
    this.name = "TaskMutationError";
  }
}

export interface TaskMutationResult {
  task: typeof tasks.$inferSelect;
  tags: SerializedTag[];
}

export interface CreateTaskMutationInput {
  title: string;
  notes?: string | null;
  priority?: string;
  taskDate?: string;
  spaceId?: string | null;
  goalId?: string | null;
  recurrence?: object | null;
  sortOrder?: number;
  tagIds?: string[];
}

export interface UpdateTaskMutationInput {
  patch: Partial<typeof tasks.$inferInsert>;
  tagIds?: string[];
  expectedUpdatedAt?: string;
}

function uniqueIds(ids: string[] | undefined): string[] | undefined {
  return ids ? [...new Set(ids.filter(Boolean))] : undefined;
}

async function validateRelationships(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  input: { spaceId?: string | null; goalId?: string | null; tagIds?: string[] }
) {
  if (input.spaceId && !(await isOwnedRelationship(tx, "space", input.spaceId, userId))) {
    throw new TaskMutationError("relationship_not_found", `Space not found: ${input.spaceId}`);
  }

  if (input.goalId && !(await isOwnedRelationship(tx, "goal", input.goalId, userId))) {
    throw new TaskMutationError("relationship_not_found", `Goal not found: ${input.goalId}`);
  }

  if (input.tagIds && input.tagIds.length > 0) {
    for (const id of input.tagIds) {
      if (!(await isOwnedRelationship(tx, "tag", id, userId))) {
        throw new TaskMutationError("relationship_not_found", `Tag not found: ${id}`);
      }
    }
  }
}

async function replaceTags(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  taskId: string,
  tagIds: string[] | undefined
) {
  if (tagIds === undefined) return;
  await tx.delete(taskTags).where(eq(taskTags.taskId, taskId));
  if (tagIds.length > 0) {
    await tx.insert(taskTags).values(tagIds.map((tagId) => ({ taskId, tagId })));
  }
}

async function readTags(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  taskId: string
): Promise<SerializedTag[]> {
  const rows = await tx
    .select({ tag: tags })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(eq(taskTags.taskId, taskId));
  return rows.map(({ tag }) => serializeTag(tag));
}

export async function createTaskAggregate(
  userId: string,
  input: CreateTaskMutationInput
): Promise<TaskMutationResult> {
  const tagIds = uniqueIds(input.tagIds);
  return db.transaction(async (tx) => {
    await validateRelationships(tx, userId, {
      spaceId: input.spaceId,
      goalId: input.goalId,
      tagIds,
    });

    const [task] = await tx
      .insert(tasks)
      .values({
        userId,
        title: input.title,
        notes: input.notes ?? null,
        priority: input.priority ?? "B1",
        taskDate: input.taskDate ?? getToday(),
        spaceId: input.spaceId ?? null,
        goalId: input.goalId ?? null,
        recurrence: input.recurrence ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    await replaceTags(tx, task.id, tagIds);
    return { task, tags: await readTags(tx, task.id) };
  });
}

export async function updateTaskAggregate(
  userId: string,
  taskId: string,
  input: UpdateTaskMutationInput
): Promise<TaskMutationResult> {
  const tagIds = uniqueIds(input.tagIds);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    if (!existing) throw new TaskMutationError("not_found", "Task not found");

    let expectedDate: Date | undefined;
    if (input.expectedUpdatedAt !== undefined) {
      expectedDate = new Date(input.expectedUpdatedAt);
      if (Number.isNaN(expectedDate.getTime())) {
        throw new TaskMutationError("invalid_expected_updated_at", "Invalid expected_updated_at");
      }
      if (existing.updatedAt.getTime() !== expectedDate.getTime()) {
        throw new TaskMutationError("conflict", "Task was modified", existing);
      }
    }

    await validateRelationships(tx, userId, {
      spaceId: input.patch.spaceId,
      goalId: input.patch.goalId,
      tagIds,
    });

    let task = existing;
    if (Object.keys(input.patch).length > 0) {
      const updatedAt = new Date();
      const condition = expectedDate
        ? and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.updatedAt, expectedDate))
        : and(eq(tasks.id, taskId), eq(tasks.userId, userId));
      const [updated] = await tx
        .update(tasks)
        .set({ ...input.patch, updatedAt })
        .where(condition)
        .returning();
      if (!updated) {
        const [current] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
          .limit(1);
        if (!current) throw new TaskMutationError("not_found", "Task not found");
        throw new TaskMutationError("conflict", "Task was modified", current);
      }
      task = updated;
    } else if (tagIds !== undefined) {
      const updatedAt = new Date();
      const condition = expectedDate
        ? and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.updatedAt, expectedDate))
        : and(eq(tasks.id, taskId), eq(tasks.userId, userId));
      const [updated] = await tx.update(tasks).set({ updatedAt }).where(condition).returning();
      if (!updated) throw new TaskMutationError("conflict", "Task was modified", existing);
      task = updated;
    }

    await replaceTags(tx, taskId, tagIds);
    return { task, tags: await readTags(tx, taskId) };
  });
}

export async function reorderTasksAggregate(
  userId: string,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  const unique = new Set(items.map(({ id }) => id));
  if (unique.size !== items.length) {
    throw new TaskMutationError("relationship_not_found", "Task IDs must be unique");
  }

  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, [...unique])));
    if (owned.length !== items.length) {
      throw new TaskMutationError("relationship_not_found", "One or more tasks were not found");
    }
    const updatedAt = new Date();
    for (const item of items) {
      await tx.update(tasks).set({ sortOrder: item.sortOrder, updatedAt }).where(eq(tasks.id, item.id));
    }
  });
}
