import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises, workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

const exerciseEntrySchema = z.object({
  name: z.string().min(1, "Exercise name is required"),
  type: z.enum(["strength", "timed", "cardio"]).optional(),
  sets: z.number().int().min(0).optional(),
  reps: z.number().int().min(0).optional(),
  weight: z.number().optional(),
  duration_seconds: z.number().optional(),
  notes: z.string().optional(),
});
const exercisesArraySchema = z.array(exerciseEntrySchema);

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getWorkoutLogs(userId: string, date?: string, from?: string, to?: string) {
  try {
    const conditions =
      date
        ? and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, date))
        : from && to
        ? and(eq(workoutLogs.userId, userId), gte(workoutLogs.logDate, from), lte(workoutLogs.logDate, to))
        : from
        ? and(eq(workoutLogs.userId, userId), gte(workoutLogs.logDate, from))
        : to
        ? and(eq(workoutLogs.userId, userId), lte(workoutLogs.logDate, to))
        : eq(workoutLogs.userId, userId);

    const logsQuery = db
      .select()
      .from(workoutLogs)
      .where(conditions)
      .orderBy(desc(workoutLogs.logDate));

    const logs = !date && !from && !to
      ? await logsQuery.limit(20)
      : await logsQuery;

    if (logs.length === 0) return { data: [], error: null };

    const logIds = logs.map((l) => l.id);
    const exercises = await db
      .select()
      .from(workoutLogExercises)
      .where(logIds.length === 1 ? eq(workoutLogExercises.logId, logIds[0]) : inArray(workoutLogExercises.logId, logIds));

    const exercisesByLog = new Map<string, typeof exercises>();
    for (const ex of exercises) {
      if (!exercisesByLog.has(ex.logId)) exercisesByLog.set(ex.logId, []);
      exercisesByLog.get(ex.logId)!.push(ex);
    }

    const data = logs.map((log) => ({
      ...log,
      workout_log_exercises: exercisesByLog.get(log.id) ?? [],
    }));

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getWorkoutTemplates(userId: string) {
  try {
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId))
      .orderBy(desc(workoutTemplates.createdAt));

    if (templates.length === 0) return { data: [], error: null };

    const templateIds = templates.map((t) => t.id);
    const exercises = await db
      .select()
      .from(workoutExercises)
      .where(templateIds.length === 1 ? eq(workoutExercises.templateId, templateIds[0]) : inArray(workoutExercises.templateId, templateIds));

    const exercisesByTemplate = new Map<string, typeof exercises>();
    for (const ex of exercises) {
      if (!exercisesByTemplate.has(ex.templateId)) exercisesByTemplate.set(ex.templateId, []);
      exercisesByTemplate.get(ex.templateId)!.push(ex);
    }

    const data = templates.map((t) => ({
      ...t,
      workout_exercises: exercisesByTemplate.get(t.id) ?? [],
    }));

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

type ExerciseEntry = z.infer<typeof exerciseEntrySchema>;

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
  let exercises: ExerciseEntry[] = [];
  if (args.exercises) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(args.exercises);
    } catch {
      return { data: null, error: "Invalid exercises JSON format" };
    }
    const validated = exercisesArraySchema.safeParse(parsed);
    if (!validated.success) {
      return {
        data: null,
        error: `Invalid exercises payload: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      };
    }
    exercises = validated.data;
  }

  try {
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId,
        name: args.name,
        logDate: args.log_date,
        durationMinutes: args.duration_minutes ?? null,
        notes: args.notes ?? null,
      })
      .returning();

    if (exercises.length > 0) {
      const exerciseRows = exercises.map((ex) => ({
        logId: log.id,
        exerciseName: ex.name,
        exerciseType: ex.type ?? "strength",
        sets:
          ex.sets != null
            ? Array.from({ length: ex.sets }, () => ({
                reps: ex.reps,
                weight: ex.weight,
                duration: ex.duration_seconds,
              }))
            : [],
      }));

      await db.insert(workoutLogExercises).values(exerciseRows);
    }

    return { data: { ...log, exercises }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
      date: dateSchema.optional().describe("Specific date in YYYY-MM-DD format"),
      from: dateSchema.optional().describe("Start date in YYYY-MM-DD format"),
      to: dateSchema.optional().describe("End date in YYYY-MM-DD format"),
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
      log_date: dateSchema.describe("Date of the workout in YYYY-MM-DD format"),
      duration_minutes: z.number().int().min(0).optional().describe("Duration in minutes"),
      notes: z.string().optional().describe("Workout notes"),
      exercises: z.string().optional().describe(
        'JSON string array of exercises. Each exercise must include "name" and may include "type" ("strength" | "timed" | "cardio"), "sets", "reps", "weight", "duration_seconds", "notes". Example: [{"name":"Squat","type":"strength","sets":3,"reps":10,"weight":100}]'
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
