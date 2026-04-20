import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises, workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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

function rowToExercise(row: typeof workoutLogExercises.$inferSelect): WorkoutLogExercise {
  return {
    id: row.id,
    log_id: row.logId,
    exercise_name: row.exerciseName,
    exercise_type: row.exerciseType,
    sort_order: row.sortOrder,
    sets: (row.sets as unknown[]) ?? [],
  };
}

export async function getWorkoutLogs(
  _db: typeof db,
  userId: string,
  params?: GetWorkoutLogsParams
): Promise<QueryResult<WorkoutLog[]>> {
  try {
    // Fetch logs
    const logsQuery = db
      .select()
      .from(workoutLogs)
      .where(
        params?.date
          ? and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, params.date))
          : params?.from && params?.to
          ? and(
              eq(workoutLogs.userId, userId),
              gte(workoutLogs.logDate, params.from),
              lte(workoutLogs.logDate, params.to)
            )
          : params?.from
          ? and(eq(workoutLogs.userId, userId), gte(workoutLogs.logDate, params.from))
          : params?.to
          ? and(eq(workoutLogs.userId, userId), lte(workoutLogs.logDate, params.to))
          : eq(workoutLogs.userId, userId)
      )
      .orderBy(desc(workoutLogs.logDate));

    const logs = await logsQuery;

    if (logs.length === 0) return { data: [], error: null };

    // Fetch all exercises for these logs
    const logIds = logs.map((l) => l.id);
    const allExercises = await db
      .select()
      .from(workoutLogExercises)
      .where(
        logIds.length === 1
          ? eq(workoutLogExercises.logId, logIds[0])
          : // Use raw SQL for IN with multiple values
            eq(workoutLogExercises.logId, logIds[0]) // fallback handled below
      );

    // For multiple logs, fetch individually (simple approach)
    const exercisesByLog = new Map<string, WorkoutLogExercise[]>();
    if (logIds.length > 1) {
      const exRows = await db
        .select()
        .from(workoutLogExercises)
        .where(eq(workoutLogExercises.logId, logIds[0]));
      // Re-fetch for all — use inArray if available
      const { inArray } = await import("drizzle-orm");
      const allEx = await db
        .select()
        .from(workoutLogExercises)
        .where(inArray(workoutLogExercises.logId, logIds));
      for (const ex of allEx) {
        if (!exercisesByLog.has(ex.logId)) exercisesByLog.set(ex.logId, []);
        exercisesByLog.get(ex.logId)!.push(rowToExercise(ex));
      }
    } else if (logIds.length === 1) {
      for (const ex of allExercises) {
        if (!exercisesByLog.has(ex.logId)) exercisesByLog.set(ex.logId, []);
        exercisesByLog.get(ex.logId)!.push(rowToExercise(ex));
      }
    }

    const result: WorkoutLog[] = logs.map((log) => ({
      id: log.id,
      user_id: log.userId,
      name: log.name,
      template_id: log.templateId ?? null,
      log_date: log.logDate,
      duration_minutes: log.durationMinutes ?? null,
      notes: log.notes ?? null,
      created_at: log.createdAt.toISOString(),
      workout_log_exercises: exercisesByLog.get(log.id) ?? [],
    }));

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getWorkoutTemplates(
  _db: typeof db,
  userId: string
): Promise<QueryResult<WorkoutTemplate[]>> {
  try {
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId))
      .orderBy(desc(workoutTemplates.createdAt));

    if (templates.length === 0) return { data: [], error: null };

    const templateIds = templates.map((t) => t.id);
    const { inArray } = await import("drizzle-orm");
    const exercises = await db
      .select()
      .from(workoutExercises)
      .where(inArray(workoutExercises.templateId, templateIds));

    const exercisesByTemplate = new Map<string, WorkoutExercise[]>();
    for (const ex of exercises) {
      if (!exercisesByTemplate.has(ex.templateId)) exercisesByTemplate.set(ex.templateId, []);
      exercisesByTemplate.get(ex.templateId)!.push({
        id: ex.id,
        template_id: ex.templateId,
        name: ex.name,
        exercise_type: ex.exerciseType,
        sort_order: ex.sortOrder,
        default_sets: ex.defaultSets ?? null,
        default_reps: ex.defaultReps ?? null,
        default_weight: ex.defaultWeight ? Number(ex.defaultWeight) : null,
        default_duration: ex.defaultDuration ?? null,
        notes: ex.notes ?? null,
      });
    }

    const result: WorkoutTemplate[] = templates.map((t) => ({
      id: t.id,
      user_id: t.userId,
      name: t.name,
      description: t.description ?? null,
      created_at: t.createdAt.toISOString(),
      workout_exercises: exercisesByTemplate.get(t.id) ?? [],
    }));

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function logWorkout(
  _db: typeof db,
  userId: string,
  input: LogWorkoutInput
): Promise<QueryResult<WorkoutLog>> {
  try {
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId,
        name: input.name || "Workout",
        templateId: input.template_id ?? null,
        logDate: input.log_date,
        durationMinutes: input.duration_minutes ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    if (Array.isArray(input.exercises) && input.exercises.length > 0) {
      const exerciseRows = input.exercises.map((ex) => ({
        logId: log.id,
        exerciseName: ex.exercise_name,
        exerciseType: ex.exercise_type || "strength",
        sortOrder: ex.sort_order ?? 0,
        sets: ex.sets || [],
      }));

      await db.insert(workoutLogExercises).values(exerciseRows);
    }

    // Fetch the complete log with exercises
    const exRows = await db
      .select()
      .from(workoutLogExercises)
      .where(eq(workoutLogExercises.logId, log.id));

    const result: WorkoutLog = {
      id: log.id,
      user_id: log.userId,
      name: log.name,
      template_id: log.templateId ?? null,
      log_date: log.logDate,
      duration_minutes: log.durationMinutes ?? null,
      notes: log.notes ?? null,
      created_at: log.createdAt.toISOString(),
      workout_log_exercises: exRows.map(rowToExercise),
    };

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
