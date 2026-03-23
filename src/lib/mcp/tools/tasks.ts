import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, PAID_PLAN_REQUIRED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTasksForDate(userId: string, date?: string, spaceId?: string) {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const taskDate = date ?? today;

  if (taskDate === today) {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .or(`task_date.eq.${taskDate},and(task_date.lt.${taskDate},done.eq.false)`)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true });

    if (spaceId) query = query.eq("space_id", spaceId);

    const { data, error } = await query;
    return { data, error: error?.message ?? null };
  }

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("task_date", taskDate)
    .order("priority", { ascending: true })
    .order("sort_order", { ascending: true });

  if (spaceId) query = query.eq("space_id", spaceId);

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
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
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: args.title,
      notes: args.notes ?? null,
      priority: args.priority ?? "B",
      task_date: args.task_date ?? today,
      space_id: args.space_id ?? null,
      goal_id: args.goal_id ?? null,
      done: false,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
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
  const supabase = getServiceClient();

  const updates: Record<string, unknown> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.notes !== undefined) updates.notes = args.notes;
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.task_date !== undefined) updates.task_date = args.task_date;
  if (args.done !== undefined) updates.done = args.done;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", args.task_id)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function completeTask(userId: string, taskId: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function deleteTask(userId: string, taskId: string) {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  return { error: error?.message ?? null };
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
      priority: z.enum(["A", "B", "C"]).optional().describe("Franklin Covey priority: A (critical), B (important), C (nice to have)"),
      task_date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      space_id: z.string().optional().describe("Space/project ID to assign to"),
      goal_id: z.string().optional().describe("Goal ID to link to"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

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
      priority: z.enum(["A", "B", "C"]).optional().describe("New priority"),
      task_date: z.string().optional().describe("New date in YYYY-MM-DD format"),
      done: z.boolean().optional().describe("Mark as done or not done"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "tasks:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

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

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

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

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await deleteTask(auth.userId, args.task_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult({ success: true });
    }
  );
}
