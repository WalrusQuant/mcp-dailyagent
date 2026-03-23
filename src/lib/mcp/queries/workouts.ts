import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";

export interface WorkoutLogExercise {
  id: string;
  log_id: string;
  exercise_name: string;
  exercise_type: string;
  sort_order: number;
  sets: unknown[];
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  log_date: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  workout_log_exercises: WorkoutLogExercise[];
}

export interface WorkoutExercise {
  id: string;
  template_id: string;
  name: string;
  exercise_type: string;
  sort_order: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
  default_duration: number | null;
  notes: string | null;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  workout_exercises: WorkoutExercise[];
}

export interface LogWorkoutExerciseInput {
  exercise_name: string;
  exercise_type?: string;
  sort_order?: number;
  sets?: unknown[];
}

export interface LogWorkoutInput {
  name: string;
  log_date: string;
  template_id?: string;
  duration_minutes?: number;
  notes?: string;
  exercises?: LogWorkoutExerciseInput[];
}

export interface GetWorkoutLogsParams {
  date?: string;
  from?: string;
  to?: string;
}

export async function getWorkoutLogs(
  supabase: SupabaseClient,
  userId: string,
  params?: GetWorkoutLogsParams
): Promise<QueryResult<WorkoutLog[]>> {
  try {
    let query = supabase
      .from("workout_logs")
      .select("*, workout_log_exercises(*)")
      .eq("user_id", userId)
      .order("log_date", { ascending: false });

    if (params?.date) {
      query = query.eq("log_date", params.date);
    } else {
      if (params?.from) query = query.gte("log_date", params.from);
      if (params?.to) query = query.lte("log_date", params.to);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as WorkoutLog[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getWorkoutTemplates(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<WorkoutTemplate[]>> {
  try {
    const { data, error } = await supabase
      .from("workout_templates")
      .select("*, workout_exercises(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as WorkoutTemplate[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function logWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: LogWorkoutInput
): Promise<QueryResult<WorkoutLog>> {
  try {
    const { data: log, error: logError } = await supabase
      .from("workout_logs")
      .insert({
        user_id: userId,
        name: input.name || "Workout",
        template_id: input.template_id ?? null,
        log_date: input.log_date,
        duration_minutes: input.duration_minutes ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (logError) return { data: null, error: logError.message };

    if (Array.isArray(input.exercises) && input.exercises.length > 0) {
      const exerciseRows = input.exercises.map((ex) => ({
        log_id: log.id,
        exercise_name: ex.exercise_name,
        exercise_type: ex.exercise_type || "strength",
        sort_order: ex.sort_order ?? 0,
        sets: ex.sets || [],
      }));

      const { error: exerciseError } = await supabase
        .from("workout_log_exercises")
        .insert(exerciseRows);

      if (exerciseError) return { data: null, error: exerciseError.message };
    }

    const { data: result, error: fetchError } = await supabase
      .from("workout_logs")
      .select("*, workout_log_exercises(*)")
      .eq("id", log.id)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };
    return { data: result as WorkoutLog, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
