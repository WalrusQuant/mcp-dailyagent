import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getWorkoutLogs(userId: string, date?: string, from?: string, to?: string) {
  const supabase = getServiceClient();

  let query = supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("user_id", userId)
    .order("log_date", { ascending: false });

  if (date) {
    query = query.eq("log_date", date);
  } else {
    if (from) query = query.gte("log_date", from);
    if (to) query = query.lte("log_date", to);
    if (!from && !to) query = query.limit(20);
  }

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
}

async function getWorkoutTemplates(userId: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("workout_templates")
    .select("*, workout_exercises(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

interface ExerciseEntry {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  notes?: string;
}

async function logWorkout(
  userId: string,
  args: {
    name: string;
    log_date: string;
    duration_minutes?: number;
    notes?: string;
    exercises?: string;
  }
) {
  const supabase = getServiceClient();

  // Parse exercises JSON if provided
  let exercises: ExerciseEntry[] = [];
  if (args.exercises) {
    try {
      exercises = JSON.parse(args.exercises) as ExerciseEntry[];
    } catch {
      return { data: null, error: "Invalid exercises JSON format" };
    }
  }

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .insert({
      user_id: userId,
      name: args.name,
      log_date: args.log_date,
      duration_minutes: args.duration_minutes ?? null,
      notes: args.notes ?? null,
    })
    .select()
    .single();

  if (logError || !log) {
    return { data: null, error: logError?.message ?? "Failed to create workout log" };
  }

  // Insert exercises if provided
  if (exercises.length > 0) {
    // Pack individual set fields into the sets JSONB array format the DB uses
    const exerciseRows = exercises.map((ex) => ({
      log_id: log.id,
      exercise_name: ex.name,
      sets: ex.sets != null
        ? Array.from({ length: ex.sets }, () => ({
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration_seconds,
          }))
        : [],
    }));

    const { error: exError } = await supabase.from("workout_log_exercises").insert(exerciseRows);
    if (exError) {
      return { data: log, error: `Workout created but exercises failed: ${exError.message}` };
    }
  }

  return { data: { ...log, exercises }, error: null };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerWorkoutTools(server: McpServer) {
  // --- list_workout_logs (READ) ---
  server.tool(
    "list_workout_logs",
    "List workout logs, optionally filtered by date or date range",
    {
      date: z.string().optional().describe("Specific date in YYYY-MM-DD format"),
      from: z.string().optional().describe("Start date in YYYY-MM-DD format"),
      to: z.string().optional().describe("End date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getWorkoutLogs(auth.userId, args.date, args.from, args.to);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- list_workout_templates (READ) ---
  server.tool(
    "list_workout_templates",
    "List all saved workout templates",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getWorkoutTemplates(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- log_workout (WRITE) ---
  server.tool(
    "log_workout",
    "Log a completed workout",
    {
      name: z.string().describe("Workout name"),
      log_date: z.string().describe("Date of the workout in YYYY-MM-DD format"),
      duration_minutes: z.number().optional().describe("Duration in minutes"),
      notes: z.string().optional().describe("Workout notes"),
      exercises: z.string().optional().describe(
        "JSON string array of exercises, e.g. [{\"name\":\"Squat\",\"sets\":3,\"reps\":10,\"weight\":100}]"
      ),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:write");
      if (scopeError) return errorResult(scopeError);

      const result = await logWorkout(auth.userId, args);
      if (result.error && !result.data) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
