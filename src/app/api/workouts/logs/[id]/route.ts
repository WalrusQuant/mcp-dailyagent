import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
    workout_log_exercises: exercises.map(serializeLogExercise),
  };
}

async function getLogWithExercises(id: string, userId: string) {
  const rows = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)));

  if (rows.length === 0) return null;

  const exercises = await db
    .select()
    .from(workoutLogExercises)
    .where(eq(workoutLogExercises.logId, id))
    .orderBy(workoutLogExercises.sortOrder);

  return serializeLog(rows[0], exercises);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const result = await getLogWithExercises(id, userId);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await request.json();

  const allowedFields: Partial<typeof workoutLogs.$inferInsert> = {};
  if (typeof body.name === "string" || body.name === null) allowedFields.name = body.name ?? undefined;
  if (typeof body.log_date === "string") allowedFields.logDate = body.log_date;
  if (typeof body.duration_minutes === "number" || body.duration_minutes === null)
    allowedFields.durationMinutes = body.duration_minutes;
  if (typeof body.notes === "string" || body.notes === null) allowedFields.notes = body.notes;

  if (Object.keys(allowedFields).length === 0 && !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    if (Object.keys(allowedFields).length > 0) {
      await db
        .update(workoutLogs)
        .set(allowedFields)
        .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)));
    }

    if (Array.isArray(body.exercises)) {
      await db.delete(workoutLogExercises).where(eq(workoutLogExercises.logId, id));

      if (body.exercises.length > 0) {
        await db.insert(workoutLogExercises).values(
          body.exercises.map(
            (ex: {
              exercise_name: string;
              exercise_type?: string;
              sort_order?: number;
              sets?: Array<{
                set_number?: number;
                reps?: number;
                weight?: number;
                duration_seconds?: number;
                notes?: string;
              }>;
            }) => ({
              logId: id,
              exerciseName: ex.exercise_name,
              exerciseType: ex.exercise_type ?? "strength",
              sortOrder: ex.sort_order ?? 0,
              sets: ex.sets ?? [],
            })
          )
        );
      }
    }

    const result = await getLogWithExercises(id, userId);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    await db
      .delete(workoutLogs)
      .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
