import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeLogExercise(e: typeof workoutLogExercises.$inferSelect) {
  return {
    id: e.id,
    log_id: e.logId,
    exercise_name: e.exerciseName,
    exercise_type: e.exerciseType,
    sort_order: e.sortOrder,
    sets: e.sets,
  };
}

function serializeLog(l: typeof workoutLogs.$inferSelect, exercises: typeof workoutLogExercises.$inferSelect[]) {
  return {
    id: l.id,
    user_id: l.userId,
    template_id: l.templateId,
    name: l.name,
    log_date: l.logDate,
    duration_minutes: l.durationMinutes,
    notes: l.notes,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    workout_log_exercises: exercises.map(serializeLogExercise),
  };
}

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const conditions = date
      ? and(eq(workoutLogs.userId, userId), eq(workoutLogs.logDate, date))
      : and(
          eq(workoutLogs.userId, userId),
          from ? gte(workoutLogs.logDate, from) : undefined,
          to ? lte(workoutLogs.logDate, to) : undefined
        );

    const logs = await db
      .select()
      .from(workoutLogs)
      .where(conditions)
      .orderBy(desc(workoutLogs.logDate));

    if (logs.length === 0) {
      return NextResponse.json([]);
    }

    const logIds = logs.map((l) => l.id);
    const exercises = await db
      .select()
      .from(workoutLogExercises)
      .where(
        logIds.length === 1
          ? eq(workoutLogExercises.logId, logIds[0])
          : inArray(workoutLogExercises.logId, logIds)
      )
      .orderBy(workoutLogExercises.sortOrder);

    const exercisesByLog: Record<string, typeof workoutLogExercises.$inferSelect[]> = {};
    for (const ex of exercises) {
      if (!exercisesByLog[ex.logId]) exercisesByLog[ex.logId] = [];
      exercisesByLog[ex.logId].push(ex);
    }

    return NextResponse.json(logs.map((l) => serializeLog(l, exercisesByLog[l.id] ?? [])));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { name, template_id, log_date, duration_minutes, notes, exercises } = body;

  if (!log_date || typeof log_date !== "string") {
    return NextResponse.json({ error: "log_date is required" }, { status: 400 });
  }

  try {
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId,
        name: name || "Workout",
        templateId: template_id ?? null,
        logDate: log_date,
        durationMinutes: duration_minutes ?? null,
        notes: notes ?? null,
      })
      .returning();

    if (Array.isArray(exercises) && exercises.length > 0) {
      await db.insert(workoutLogExercises).values(
        exercises.map(
          (ex: {
            exercise_name: string;
            exercise_type?: string;
            sort_order?: number;
            sets?: Array<{ reps?: number; weight?: number; duration?: number }>;
          }) => ({
            logId: log.id,
            exerciseName: ex.exercise_name,
            exerciseType: ex.exercise_type || "strength",
            sortOrder: ex.sort_order ?? 0,
            sets: ex.sets || [],
          })
        )
      );
    }

    const exRows = await db
      .select()
      .from(workoutLogExercises)
      .where(eq(workoutLogExercises.logId, log.id))
      .orderBy(workoutLogExercises.sortOrder);

    return NextResponse.json(serializeLog(log, exRows), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
