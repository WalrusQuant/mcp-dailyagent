import { SupabaseClient } from "@supabase/supabase-js";
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

export async function getGoals(
  supabase: SupabaseClient,
  userId: string,
  status = "active"
): Promise<QueryResult<Goal[]>> {
  try {
    let query = supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status as "active" | "completed" | "abandoned");
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as Goal[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createGoal(
  supabase: SupabaseClient,
  userId: string,
  input: CreateGoalInput
): Promise<QueryResult<Goal>> {
  try {
    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        title: input.title.trim(),
        ...(input.description ? { description: input.description } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.target_date ? { target_date: input.target_date } : {}),
        ...(input.progress_mode ? { progress_mode: input.progress_mode } : {}),
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Goal, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  fields: UpdateGoalFields
): Promise<QueryResult<Goal>> {
  try {
    const allowedFields: Record<string, unknown> = {};

    if (typeof fields.title === "string") allowedFields.title = fields.title;
    if (typeof fields.description === "string" || fields.description === null)
      allowedFields.description = fields.description;
    if (typeof fields.status === "string") {
      allowedFields.status = fields.status;
      if (fields.status === "completed") {
        allowedFields.completed_at = new Date().toISOString();
      } else if (fields.status === "active") {
        allowedFields.completed_at = null;
      }
    }
    if (typeof fields.progress === "number") allowedFields.progress = fields.progress;
    if (typeof fields.target_date === "string" || fields.target_date === null)
      allowedFields.target_date = fields.target_date;

    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("goals")
      .update(allowedFields)
      .eq("id", goalId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Goal, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function logGoalProgress(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  progress: number
): Promise<QueryResult<Goal>> {
  try {
    const today = getToday();

    const { data: goal, error: updateError } = await supabase
      .from("goals")
      .update({
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) return { data: null, error: updateError.message };

    await supabase.from("goal_progress_logs").upsert(
      { goal_id: goalId, user_id: userId, log_date: today, progress },
      { onConflict: "goal_id,log_date" }
    );

    return { data: goal as Goal, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
