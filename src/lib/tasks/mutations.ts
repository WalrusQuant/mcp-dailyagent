import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tags, taskRecurrenceSeries, tasks, taskTags } from "@/lib/db/schema";
import { serializeTag, type SerializedTag } from "@/lib/mcp/queries/tags";
import { isAssignableRelationship, isOwnedRelationship } from "@/lib/db/ownership";
import { nextOccurrenceDate, parseRecurrenceRule, type RecurrenceRule } from "@/lib/tasks/recurrence";

export type TaskMutationErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_expected_updated_at"
  | "relationship_not_found"
  | "invalid_recurrence";

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
  taskDate: string;
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
  recurrenceScope?: "occurrence" | "future";
}

function uniqueIds(ids: string[] | undefined): string[] | undefined {
  return ids ? [...new Set(ids.filter(Boolean))] : undefined;
}

async function validateRelationships(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  input: { spaceId?: string | null; goalId?: string | null; tagIds?: string[] }
) {
  if (input.spaceId && !(await isAssignableRelationship(tx, "space", input.spaceId, userId))) {
    throw new TaskMutationError("relationship_not_found", `Space is not assignable: ${input.spaceId}`);
  }

  if (input.goalId && !(await isAssignableRelationship(tx, "goal", input.goalId, userId))) {
    throw new TaskMutationError("relationship_not_found", `Goal is not assignable: ${input.goalId}`);
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

type TaskTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function createSeries(
  tx: TaskTransaction,
  userId: string,
  rule: RecurrenceRule,
  anchorDate: string
) {
  const [series] = await tx
    .insert(taskRecurrenceSeries)
    .values({ userId, rule, anchorDate })
    .returning();
  return series;
}

async function applyRecurrenceChange(
  tx: TaskTransaction,
  userId: string,
  existing: typeof tasks.$inferSelect,
  recurrence: object | null,
  scope: "occurrence" | "future"
) {
  const rule = recurrence === null ? null : parseRecurrenceRule(recurrence);
  if (recurrence !== null && !rule) {
    throw new TaskMutationError("invalid_recurrence", "Invalid recurrence rule");
  }

  const scheduledDate = existing.scheduledDate ?? existing.taskDate;
  if (scope === "future" && existing.recurrenceSeriesId) {
    const [oldSeries] = await tx
      .select()
      .from(taskRecurrenceSeries)
      .where(
        and(
          eq(taskRecurrenceSeries.id, existing.recurrenceSeriesId),
          eq(taskRecurrenceSeries.userId, userId)
        )
      )
      .limit(1);
    if (!oldSeries) throw new TaskMutationError("invalid_recurrence", "Recurrence series not found");

    // Close the old rule immediately before this occurrence. Historical tasks
    // retain their original series and can no longer regenerate across the split.
    await tx
      .update(taskRecurrenceSeries)
      .set({ endsBefore: scheduledDate, updatedAt: new Date() })
      .where(eq(taskRecurrenceSeries.id, oldSeries.id));

    // A series normally has one materialized successor. Remove uncompleted
    // future materializations so they can be recreated from the new rule.
    await tx
      .delete(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.recurrenceSeriesId, oldSeries.id),
          gt(tasks.scheduledDate, scheduledDate),
          eq(tasks.done, false)
        )
      );

    if (rule) {
      const series = await createSeries(tx, userId, rule, scheduledDate);
      await tx
        .update(tasks)
        .set({ recurrence: rule, recurrenceSeriesId: series.id, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.id, existing.id)
          )
        );

      if (existing.done) {
        const [current] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, existing.id), eq(tasks.userId, userId)))
          .limit(1);
        await spawnNextOccurrence(tx, userId, current);
      }
    } else {
      await tx
        .update(tasks)
        .set({ recurrence: null, recurrenceSeriesId: null, scheduledDate: null, updatedAt: new Date() })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, existing.id)));
    }
    return;
  }

  if (!rule) {
    if (existing.recurrenceSeriesId) {
      // Keep this occurrence's series/date reservation as historical identity
      // and materialize the old cadence before disabling recurrence locally.
      // This prevents an earlier occurrence from recreating this date later.
      await spawnNextOccurrence(tx, userId, existing);
      await tx
        .update(tasks)
        .set({ recurrence: null, updatedAt: new Date() })
        .where(and(eq(tasks.id, existing.id), eq(tasks.userId, userId)));
      return;
    }
    await tx
      .update(tasks)
      .set({ recurrence: null, recurrenceSeriesId: null, scheduledDate: null, updatedAt: new Date() })
      .where(and(eq(tasks.id, existing.id), eq(tasks.userId, userId)));
    return;
  }

  if (existing.recurrenceSeriesId) {
    throw new TaskMutationError(
      "invalid_recurrence",
      "Changing a recurrence rule requires future scope"
    );
  }

  const series = await createSeries(tx, userId, rule, scheduledDate);
  await tx
    .update(tasks)
    .set({ recurrence: rule, recurrenceSeriesId: series.id, scheduledDate, updatedAt: new Date() })
    .where(and(eq(tasks.id, existing.id), eq(tasks.userId, userId)));
}

async function spawnNextOccurrence(
  tx: TaskTransaction,
  userId: string,
  row: typeof tasks.$inferSelect
) {
  const legacyRule = parseRecurrenceRule(row.recurrence);
  if (!legacyRule) return;

  let seriesId = row.recurrenceSeriesId;
  const scheduledDate = row.scheduledDate ?? row.taskDate;
  let anchorDate = scheduledDate;
  let rule = legacyRule;

  if (seriesId) {
    const [series] = await tx
      .select()
      .from(taskRecurrenceSeries)
      .where(and(eq(taskRecurrenceSeries.id, seriesId), eq(taskRecurrenceSeries.userId, userId)))
      .limit(1);
    if (!series) return;
    if (series.endsBefore && scheduledDate >= series.endsBefore) return;
    anchorDate = series.anchorDate;
    const parsed = parseRecurrenceRule(series.rule);
    if (!parsed) return;
    rule = parsed;
  } else {
    const series = await createSeries(tx, userId, rule, scheduledDate);
    seriesId = series.id;
    await tx
      .update(tasks)
      .set({ recurrenceSeriesId: seriesId, scheduledDate })
      .where(and(eq(tasks.id, row.id), eq(tasks.userId, userId)));
  }

  const nextScheduledDate = nextOccurrenceDate(scheduledDate, rule, anchorDate);
  if (seriesId) {
    const [series] = await tx
      .select({ endsBefore: taskRecurrenceSeries.endsBefore })
      .from(taskRecurrenceSeries)
      .where(eq(taskRecurrenceSeries.id, seriesId))
      .limit(1);
    if (series?.endsBefore && nextScheduledDate >= series.endsBefore) return;
  }
  // Historical occurrences keep their links, but a closed parent must not be
  // inherited by future work. The successor is intentionally unassigned.
  const successorSpaceId = row.spaceId && await isAssignableRelationship(tx, "space", row.spaceId, userId)
    ? row.spaceId
    : null;
  const successorGoalId = row.goalId && await isAssignableRelationship(tx, "goal", row.goalId, userId)
    ? row.goalId
    : null;
  const [successor] = await tx
    .insert(tasks)
    .values({
      userId,
      title: row.title,
      notes: row.notes,
      priority: row.priority,
      sortOrder: row.sortOrder,
      taskDate: nextScheduledDate,
      spaceId: successorSpaceId,
      goalId: successorGoalId,
      recurrence: rule,
      recurrenceSeriesId: seriesId,
      scheduledDate: nextScheduledDate,
    })
    .onConflictDoNothing({
      target: [tasks.recurrenceSeriesId, tasks.scheduledDate],
    })
    .returning();

  if (successor) {
    const existingTags = await tx
      .select({ tagId: taskTags.tagId })
      .from(taskTags)
      .where(eq(taskTags.taskId, row.id));
    if (existingTags.length > 0) {
      await tx.insert(taskTags).values(
        existingTags.map(({ tagId }) => ({ taskId: successor.id, tagId }))
      );
    }
  }
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

    const taskDate = input.taskDate;
    const rule = input.recurrence ? parseRecurrenceRule(input.recurrence) : null;
    if (input.recurrence && !rule) {
      throw new TaskMutationError("invalid_recurrence", "Invalid recurrence rule");
    }
    const series = rule ? await createSeries(tx, userId, rule, taskDate) : null;

    const [task] = await tx
      .insert(tasks)
      .values({
        userId,
        title: input.title,
        notes: input.notes ?? null,
        priority: input.priority ?? "B1",
        taskDate,
        spaceId: input.spaceId ?? null,
        goalId: input.goalId ?? null,
        recurrence: rule,
        recurrenceSeriesId: series?.id ?? null,
        scheduledDate: series ? taskDate : null,
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

    const patch = { ...input.patch };
    if (existing.done && patch.done === true) {
      delete patch.done;
      delete patch.doneAt;
    }
    const hasRecurrenceChange = Object.prototype.hasOwnProperty.call(patch, "recurrence");
    const recurrence = hasRecurrenceChange ? (patch.recurrence as object | null) : undefined;
    if (hasRecurrenceChange) delete patch.recurrence;

    let task = existing;
    if (Object.keys(patch).length > 0) {
      const updatedAt = new Date();
      let condition = expectedDate
        ? and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.updatedAt, expectedDate))
        : and(eq(tasks.id, taskId), eq(tasks.userId, userId));
      if (patch.done === true && !existing.done) {
        condition = and(condition, eq(tasks.done, false));
      }
      const [updated] = await tx
        .update(tasks)
        .set({ ...patch, updatedAt })
        .where(condition)
        .returning();
      if (!updated) {
        const [current] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
          .limit(1);
        if (!current) throw new TaskMutationError("not_found", "Task not found");
        const completionOnly = Object.keys(patch).every((key) => key === "done" || key === "doneAt");
        if (!expectedDate && completionOnly && current.done) {
          task = current;
        } else {
          throw new TaskMutationError("conflict", "Task was modified", current);
        }
      } else {
        task = updated;
      }
    } else if (tagIds !== undefined && !hasRecurrenceChange) {
      const updatedAt = new Date();
      const condition = expectedDate
        ? and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.updatedAt, expectedDate))
        : and(eq(tasks.id, taskId), eq(tasks.userId, userId));
      const [updated] = await tx.update(tasks).set({ updatedAt }).where(condition).returning();
      if (!updated) throw new TaskMutationError("conflict", "Task was modified", existing);
      task = updated;
    }

    if (hasRecurrenceChange) {
      if (Object.keys(patch).length === 0) {
        const updatedAt = new Date();
        const condition = expectedDate
          ? and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.updatedAt, expectedDate))
          : and(eq(tasks.id, taskId), eq(tasks.userId, userId));
        const [touched] = await tx.update(tasks).set({ updatedAt }).where(condition).returning();
        if (!touched) {
          const [current] = await tx
            .select()
            .from(tasks)
            .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
            .limit(1);
          if (!current) throw new TaskMutationError("not_found", "Task not found");
          throw new TaskMutationError("conflict", "Task was modified", current);
        }
        task = touched;
      }
      await applyRecurrenceChange(
        tx,
        userId,
        task,
        recurrence ?? null,
        input.recurrenceScope ?? "occurrence"
      );
      const [withRecurrence] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
        .limit(1);
      task = withRecurrence;
    }

    if (!existing.done && task.done) {
      await spawnNextOccurrence(tx, userId, task);
      const [completed] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
        .limit(1);
      task = completed;
    }

    await replaceTags(tx, taskId, tagIds);
    return { task, tags: await readTags(tx, taskId) };
  });
}

export async function completeTaskAggregate(
  userId: string,
  taskId: string,
  expectedUpdatedAt?: string
): Promise<TaskMutationResult> {
  return updateTaskAggregate(userId, taskId, {
    patch: { done: true, doneAt: new Date() },
    expectedUpdatedAt,
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
