import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, or, lt, asc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, prioritySchema, priorityDescription } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTasksForDate(userId: string, date?: string, spaceId?: string) {
  const today = new Date().toISOString().split("T")[0];
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

async function createTask(
  userId: string,
  args: {
    title: string;
    notes?: string;
    priority?: string;
    task_date?: string;
    space_id?: string;
    goal_id?: string;
  }
) {
  const today = new Date().toISOString().split("T")[0];
  try {
    const [row] = await db
      .insert(tasks)
      .values({
        userId,
        title: args.title,
        notes: args.notes ?? null,
        priority: args.priority ?? "B1",
        taskDate: args.task_date ?? today,
        spaceId: args.space_id ?? null,
        goalId: args.goal_id ?? null,
        done: false,
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function updateTask(
  userId: string,
  args: {
    task_id: string;
    title?: string;
    notes?: string;
    priority?: string;
    task_date?: string;
    done?: boolean;
  }
) {
  const updates: Partial<typeof tasks.$inferInsert> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.notes !== undefined) updates.notes = args.notes;
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.task_date !== undefined) updates.taskDate = args.task_date;
  if (args.done !== undefined) {
    updates.done = args.done;
    updates.doneAt = args.done ? new Date() : null;
  }
  updates.updatedAt = new Date();

  try {
    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, args.task_id), eq(tasks.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Task not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function completeTask(userId: string, taskId: string) {
  try {
    const [row] = await db
      .update(tasks)
      .set({ done: true, doneAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Task not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteTask(userId: string, taskId: string) {
  try {
    await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    return { error: null };
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
      date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      space_id: z.string().optional().describe("Filter by space/project ID"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTasksForDate(auth.userId, args.date, args.space_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_task (WRITE) ---
  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      notes: z.string().optional().describe("Additional notes"),
      priority: prioritySchema.optional().describe(priorityDescription),
      task_date: dateSchema.optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      space_id: z.string().optional().describe("Space/project ID to assign to"),
      goal_id: z.string().optional().describe("Goal ID to link to"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createTask(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- update_task (WRITE) ---
  server.tool(
    "update_task",
    "Update an existing task",
    {
      task_id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      notes: z.string().optional().describe("New notes"),
      priority: prioritySchema.optional().describe(priorityDescription),
      task_date: dateSchema.optional().describe("New date in YYYY-MM-DD format"),
      done: z.boolean().optional().describe("Mark as done or not done"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      const result = await updateTask(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- complete_task (WRITE) ---
  server.tool(
    "complete_task",
    "Mark a task as complete",
    {
      task_id: z.string().describe("Task ID to complete"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      const result = await completeTask(auth.userId, args.task_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- delete_task (WRITE) ---
  server.tool(
    "delete_task",
    "Delete a task permanently",
    {
      task_id: z.string().describe("Task ID to delete"),
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
