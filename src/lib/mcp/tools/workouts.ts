import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises, workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, exerciseTypeSchema } from "./validators";

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

const templateExerciseSchema = z.object({
  name: z.string().min(1, "Exercise name is required"),
  type: exerciseTypeSchema.optional(),
  default_sets: z.number().int().min(0).optional(),
  default_reps: z.number().int().min(0).optional(),
  default_weight: z.number().optional(),
  default_duration_seconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});
const templateExercisesArraySchema = z.array(templateExerciseSchema);

/** Parse + validate a JSON-string exercises payload against a schema. */
function parseExercisesJson<T>(raw: string, schema: z.ZodType<T>): { data: T | null; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: null, error: "Invalid exercises JSON format" };
  }
  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return {
      data: null,
      error: `Invalid exercises payload: ${validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    };
  }
  return { data: validated.data, error: null };
}

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
type TemplateExerciseEntry = z.infer<typeof templateExerciseSchema>;

/** Map validated log-exercise entries to insertable workout_log_exercises rows. */
function buildLogExerciseRows(logId: string, exercises: ExerciseEntry[]) {
  return exercises.map((ex, i) => ({
    logId,
    exerciseName: ex.name,
    exerciseType: ex.type ?? "strength",
    sortOrder: i,
    sets:
      ex.sets != null
        ? Array.from({ length: ex.sets }, () => ({
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration_seconds,
          }))
        : [],
  }));
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
  let exercises: ExerciseEntry[] = [];
  if (args.exercises) {
    const parsed = parseExercisesJson(args.exercises, exercisesArraySchema);
    if (parsed.error) return { data: null, error: parsed.error };
    exercises = parsed.data!;
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
      await db.insert(workoutLogExercises).values(buildLogExerciseRows(log.id, exercises));
    }

    return { data: { ...log, exercises }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function createWorkoutTemplate(
  userId: string,
  args: {
    name: string;
    description?: string;
    exercises?: string;
  }
) {
  let exercises: TemplateExerciseEntry[] = [];
  if (args.exercises) {
    const parsed = parseExercisesJson(args.exercises, templateExercisesArraySchema);
    if (parsed.error) return { data: null, error: parsed.error };
    exercises = parsed.data!;
  }

  try {
    const [template] = await db
      .insert(workoutTemplates)
      .values({
        userId,
        name: args.name,
        description: args.description ?? null,
      })
      .returning();

    if (exercises.length > 0) {
      const exerciseRows = exercises.map((ex, i) => ({
        templateId: template.id,
        name: ex.name,
        exerciseType: ex.type ?? "strength",
        sortOrder: i,
        defaultSets: ex.default_sets ?? null,
        defaultReps: ex.default_reps ?? null,
        defaultWeight: ex.default_weight != null ? String(ex.default_weight) : null,
        defaultDuration: ex.default_duration_seconds ?? null,
        notes: ex.notes ?? null,
      }));
      await db.insert(workoutExercises).values(exerciseRows);
    }

    return { data: { ...template, workout_exercises: exercises }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function updateWorkoutLog(
  userId: string,
  args: {
    log_id: string;
    name?: string;
    log_date?: string;
    duration_minutes?: number;
    notes?: string;
    exercises?: string;
  }
) {
  // Validate the exercises payload up front (if provided) so we never partially apply.
  let exercises: ExerciseEntry[] | null = null;
  if (args.exercises !== undefined) {
    const parsed = parseExercisesJson(args.exercises, exercisesArraySchema);
    if (parsed.error) return { data: null, error: parsed.error };
    exercises = parsed.data!;
  }

  try {
    const patch: Partial<typeof workoutLogs.$inferInsert> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.log_date !== undefined) patch.logDate = args.log_date;
    if (args.duration_minutes !== undefined) patch.durationMinutes = args.duration_minutes;
    if (args.notes !== undefined) patch.notes = args.notes;
    patch.updatedAt = new Date();

    const [row] = await db
      .update(workoutLogs)
      .set(patch)
      .where(and(eq(workoutLogs.id, args.log_id), eq(workoutLogs.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Workout log not found" };

    // When exercises are supplied, replace the full set (omit the field to leave them untouched).
    if (exercises !== null) {
      await db.delete(workoutLogExercises).where(eq(workoutLogExercises.logId, args.log_id));
      if (exercises.length > 0) {
        await db.insert(workoutLogExercises).values(buildLogExerciseRows(args.log_id, exercises));
      }
    }

    const logExercises = await db
      .select()
      .from(workoutLogExercises)
      .where(eq(workoutLogExercises.logId, args.log_id));

    return { data: { ...row, workout_log_exercises: logExercises }, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteWorkoutLog(userId: string, logId: string) {
  try {
    const deleted = await db
      .delete(workoutLogs)
      .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, userId)))
      .returning({ id: workoutLogs.id });
    return { error: deleted.length > 0 ? null : "Workout log not found" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteWorkoutTemplate(userId: string, templateId: string) {
  try {
    const deleted = await db
      .delete(workoutTemplates)
      .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)))
      .returning({ id: workoutTemplates.id });
    return { error: deleted.length > 0 ? null : "Workout template not found" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
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
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_workout_template (WRITE) ---
  server.tool(
    "create_workout_template",
    "Create a reusable workout template (routine) with an optional list of exercises",
    {
      name: z.string().min(1).describe("Template name"),
      description: z.string().optional().describe("Template description"),
      exercises: z.string().optional().describe(
        'JSON string array of exercises. Each exercise must include "name" and may include "type" ("strength" | "timed" | "cardio"), "default_sets", "default_reps", "default_weight", "default_duration_seconds", "notes". Example: [{"name":"Squat","type":"strength","default_sets":3,"default_reps":10,"default_weight":100}]'
      ),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createWorkoutTemplate(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- update_workout_log (WRITE) ---
  server.tool(
    "update_workout_log",
    "Update an existing workout log. Only the fields you pass are changed. Passing 'exercises' replaces the full exercise list; omit it to leave exercises untouched.",
    {
      log_id: z.string().describe("Workout log ID to update"),
      name: z.string().optional().describe("New workout name"),
      log_date: dateSchema.optional().describe("New date in YYYY-MM-DD format"),
      duration_minutes: z.number().int().min(0).optional().describe("New duration in minutes"),
      notes: z.string().optional().describe("New workout notes"),
      exercises: z.string().optional().describe(
        'JSON string array of exercises that REPLACES the existing list. Each exercise must include "name" and may include "type" ("strength" | "timed" | "cardio"), "sets", "reps", "weight", "duration_seconds", "notes". Pass an empty array [] to clear all exercises.'
      ),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:write");
      if (scopeError) return errorResult(scopeError);

      const result = await updateWorkoutLog(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- delete_workout_log (WRITE) ---
  server.tool(
    "delete_workout_log",
    "Delete a workout log permanently (also removes its logged exercises)",
    {
      log_id: z.string().describe("Workout log ID to delete"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:write");
      if (scopeError) return errorResult(scopeError);

      const result = await deleteWorkoutLog(auth.userId, args.log_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult({ success: true });
    }
  );

  // --- delete_workout_template (WRITE) ---
  server.tool(
    "delete_workout_template",
    "Delete a workout template permanently (its exercises are removed; past logs created from it are kept)",
    {
      template_id: z.string().describe("Workout template ID to delete"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "workouts:write");
      if (scopeError) return errorResult(scopeError);

      const result = await deleteWorkoutTemplate(auth.userId, args.template_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult({ success: true });
    }
  );
}
