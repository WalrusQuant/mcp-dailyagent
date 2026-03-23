import { SupabaseClient } from "@supabase/supabase-js";
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

export async function getTasksForDate(
  supabase: SupabaseClient,
  userId: string,
  date?: string
): Promise<QueryResult<Task[]>> {
  try {
    const today = getToday();
    const taskDate = date || today;

    if (taskDate === today) {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .or(`task_date.eq.${taskDate},and(task_date.lt.${taskDate},done.eq.false)`)
        .order("priority", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data as Task[], error: null };
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("task_date", taskDate)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as Task[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getOverdueTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<Task[]>> {
  try {
    const today = getToday();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .lt("task_date", today)
      .eq("done", false)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as Task[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTaskInput
): Promise<QueryResult<Task>> {
  try {
    const today = getToday();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: input.title,
        notes: input.notes || null,
        priority: typeof input.priority === "string" ? input.priority : "B1",
        task_date: input.task_date || today,
        space_id: input.space_id || null,
        goal_id: input.goal_id || null,
        recurrence: input.recurrence || null,
        sort_order: typeof input.sort_order === "number" ? input.sort_order : 0,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Task, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  fields: UpdateTaskFields
): Promise<QueryResult<Task>> {
  try {
    const allowedFields: Record<string, unknown> = {};

    if (typeof fields.title === "string") allowedFields.title = fields.title;
    if (typeof fields.notes === "string" || fields.notes === null) allowedFields.notes = fields.notes;
    if (typeof fields.priority === "string") allowedFields.priority = fields.priority;
    if (typeof fields.task_date === "string") allowedFields.task_date = fields.task_date;
    if (typeof fields.space_id === "string" || fields.space_id === null)
      allowedFields.space_id = fields.space_id;
    if (typeof fields.goal_id === "string" || fields.goal_id === null)
      allowedFields.goal_id = fields.goal_id;
    if (typeof fields.done === "boolean") {
      allowedFields.done = fields.done;
      allowedFields.done_at = fields.done ? new Date().toISOString() : null;
    }
    if (typeof fields.sort_order === "number") allowedFields.sort_order = fields.sort_order;

    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(allowedFields)
      .eq("id", taskId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Task, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function completeTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<QueryResult<Task>> {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .update({
        done: true,
        done_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Task, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<QueryResult<{ success: boolean }>> {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
