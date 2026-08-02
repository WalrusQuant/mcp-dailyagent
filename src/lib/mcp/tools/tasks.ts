import { getProfileToday } from "@/lib/date-context";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, lt, asc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, conflictResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, prioritySchema, priorityDescription, recurrenceSchema, uuidSchema } from "./validators";
import { getTagsByTaskIds } from "@/lib/mcp/queries/tags";
import {
  completeTaskAggregate,
  createTaskAggregate,
  TaskMutationError,
  updateTaskAggregate,
} from "@/lib/tasks/mutations";
import { serializeTask } from "@/lib/mcp/queries/tasks";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTasksForDate(userId: string, date?: string, spaceId?: string) {
  const today = await getProfileToday(userId);
  const taskDate = date ?? today;

  const baseConditions =
    taskDate === today
      ? and(
          eq(tasks.userId, userId),
          or(
            eq(tasks.taskDate, taskDate),
            and(lt(tasks.taskDate, taskDate), eq(tasks.done, false))
          )
        )
      : and(eq(tasks.userId, userId), eq(tasks.taskDate, taskDate));

  let query = db.select().from(tasks).where(baseConditions).orderBy(asc(tasks.priority), asc(tasks.sortOrder));

  if (spaceId) {
    query = db
      .select()
      .from(tasks)
      .where(and(baseConditions, eq(tasks.spaceId, spaceId)))
      .orderBy(asc(tasks.priority), asc(tasks.sortOrder));
  }

  try {
    const rows = await query;
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function normalizeRecurrence(
  rec: unknown
): { type: string; days?: number[] } | null | undefined {
  if (rec === undefined) return undefined;
  if (rec === null) return null;
  const parsed = recurrenceSchema.safeParse(rec);
  return parsed.success ? parsed.data : undefined;
}

function buildTaskPatch(args: {
  title?: string;
  notes?: string;
  priority?: string;
  task_date?: string;
  done?: boolean;
  space_id?: string | null;
  goal_id?: string | null;
  recurrence?: { type: string; days?: number[] } | null;
}): Partial<typeof tasks.$inferInsert> {
  const patch: Partial<typeof tasks.$inferInsert> = {};
  if (args.title !== undefined) patch.title = args.title;
  if (args.notes !== undefined) patch.notes = args.notes;
  if (args.priority !== undefined) patch.priority = args.priority;
  if (args.task_date !== undefined) patch.taskDate = args.task_date;
  if (args.space_id !== undefined) patch.spaceId = args.space_id;
  if (args.goal_id !== undefined) patch.goalId = args.goal_id;
  if (args.recurrence !== undefined) patch.recurrence = args.recurrence;
  if (args.done !== undefined) {
    patch.done = args.done;
    patch.doneAt = args.done ? new Date() : null;
  }
  return patch;
}

async function deleteTask(userId: string, taskId: string) {
  try {
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning({ id: tasks.id });
    return { error: deleted.length > 0 ? null : "Task not found" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTaskTools(server: McpServer) {
  // --- list_tasks (READ) ---
  server.tool(
    "list_tasks",
    "List tasks for a given date (defaults to today). Incomplete tasks from previous days are included when viewing today.",
    {
      date: dateSchema.optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      space_id: uuidSchema.optional().describe("Filter by space/project ID (from list_spaces)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTasksForDate(auth.userId, args.date, args.space_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      const rows = result.data ?? [];
      const taskTags = await getTagsByTaskIds(rows.map((task) => task.id));
      return textResult(rows.map((task) => ({ ...serializeTask(task), tags: taskTags.get(task.id) ?? [] })));
    }
  );

  const taskRecurrenceSchema = recurrenceSchema.nullable().optional();

  // --- create_task (WRITE) ---
  server.tool(
    "create_task",
    "Create a new task. Supports recurrence (daily/weekdays/weekly/monthly) and links to space or goal.",
    {
      title: z.string().describe("Task title"),
      notes: z.string().optional().describe("Additional notes"),
      priority: prioritySchema.optional().describe(priorityDescription),
      task_date: dateSchema.optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      space_id: uuidSchema.optional().describe("Space/project ID to assign to (from list_spaces)"),
      goal_id: uuidSchema.optional().describe("Goal ID to link to (from list_goals)"),
      recurrence: taskRecurrenceSchema.describe(
        "Recurrence rule, or null/omit for one-off. Weekly may include days (1=Mon…7=Sun)."
      ),
      tag_ids: z.array(uuidSchema).optional().describe("Tag IDs to assign (from list_tags)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      const recurrence = normalizeRecurrence(args.recurrence);
      if (args.recurrence !== undefined && args.recurrence !== null && recurrence === undefined) {
        return errorResult("Invalid recurrence");
      }

      try {
        const result = await createTaskAggregate(auth.userId, {
          title: args.title,
          notes: args.notes,
          priority: args.priority,
          taskDate: args.task_date ?? await getProfileToday(auth.userId),
          spaceId: args.space_id,
          goalId: args.goal_id,
          recurrence: recurrence === undefined ? null : recurrence,
          tagIds: args.tag_ids,
        });
        return textResult({ ...serializeTask(result.task), tags: result.tags });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Unable to create task");
      }
    }
  );

  // --- update_task (WRITE) ---
  server.tool(
    "update_task",
    "Update one or more fields of an existing task. To only mark a task done, prefer complete_task. Marking a recurring task done schedules its next occurrence (same as complete_task). Pass expected_updated_at (from the last read of this task) to opt into concurrency-safe writes — the call will fail with a conflict if the task was modified in the meantime.",
    {
      task_id: uuidSchema.describe("Task ID (from list_tasks)"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency. Omit for last-write-wins."),
      title: z.string().optional().describe("New title"),
      notes: z.string().optional().describe("New notes"),
      priority: prioritySchema.optional().describe(priorityDescription),
      task_date: dateSchema.optional().describe("New date in YYYY-MM-DD format"),
      done: z.boolean().optional().describe("Mark as done or not done"),
      space_id: uuidSchema.nullable().optional().describe("Space ID, or null to unlink"),
      goal_id: uuidSchema.nullable().optional().describe("Goal ID, or null to unlink"),
      recurrence: taskRecurrenceSchema.describe("Recurrence rule, or null to clear"),
      recurrence_scope: z
        .enum(["occurrence", "future"])
        .optional()
        .describe("Apply a recurrence change only to this occurrence or to this and future occurrences"),
      tag_ids: z.array(uuidSchema).optional().describe("Replacement tag IDs (from list_tags)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      let recurrencePatch: { type: string; days?: number[] } | null | undefined = undefined;
      if (args.recurrence !== undefined) {
        if (args.recurrence === null) {
          recurrencePatch = null;
        } else {
          recurrencePatch = normalizeRecurrence(args.recurrence);
          if (recurrencePatch === undefined) return errorResult("Invalid recurrence");
        }
      }

      const patchArgs = {
        title: args.title,
        notes: args.notes,
        priority: args.priority,
        task_date: args.task_date,
        done: args.done,
        space_id: args.space_id,
        goal_id: args.goal_id,
        recurrence: recurrencePatch,
      };

      try {
        const result = await updateTaskAggregate(auth.userId, args.task_id, {
          patch: buildTaskPatch(patchArgs),
          tagIds: args.tag_ids,
          expectedUpdatedAt: args.expected_updated_at,
          recurrenceScope: args.recurrence_scope,
        });
        return textResult({ ...serializeTask(result.task), tags: result.tags });
      } catch (err) {
        if (err instanceof TaskMutationError) {
          if (err.code === "conflict" && err.current) return conflictResult(err.current);
          return errorResult(err.message);
        }
        return errorResult(err instanceof Error ? err.message : "Unable to update task");
      }
    }
  );

  // --- complete_task (WRITE) ---
  server.tool(
    "complete_task",
    "Mark a task as complete. Preferred for simply finishing a task; use update_task only when also changing other fields. Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      task_id: uuidSchema.describe("Task ID to complete (from list_tasks)"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency."),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      try {
        const result = await completeTaskAggregate(
          auth.userId,
          args.task_id,
          args.expected_updated_at
        );
        return textResult({ ...serializeTask(result.task), tags: result.tags });
      } catch (err) {
        if (err instanceof TaskMutationError) {
          if (err.code === "conflict" && err.current) return conflictResult(err.current);
          return errorResult(err.message);
        }
        return errorResult(err instanceof Error ? err.message : "Unable to complete task");
      }
    }
  );

  // --- delete_task (WRITE) ---
  server.tool(
    "delete_task",
    "Delete a task permanently",
    {
      task_id: uuidSchema.describe("Task ID to delete (from list_tasks)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      const result = await deleteTask(auth.userId, args.task_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult({ success: true });
    }
  );
}
