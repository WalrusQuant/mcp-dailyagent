import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTemplate } from "@/lib/mcp/queries/workouts";

async function getTemplateWithExercises(id: string, userId: string) {
  const rows = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));

  if (rows.length === 0) return null;

  const exercises = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.templateId, id))
    .orderBy(workoutExercises.sortOrder);

  return serializeTemplate(rows[0], exercises);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const result = await getTemplateWithExercises(id, userId);
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

  const allowedFields: Partial<typeof workoutTemplates.$inferInsert> = {};
  if (typeof body.name === "string") allowedFields.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;

  if (Object.keys(allowedFields).length === 0 && !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    if (Object.keys(allowedFields).length > 0) {
      await db
        .update(workoutTemplates)
        .set(allowedFields)
        .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));
    }

    if (Array.isArray(body.exercises)) {
      await db.delete(workoutExercises).where(eq(workoutExercises.templateId, id));

      if (body.exercises.length > 0) {
        await db.insert(workoutExercises).values(
          body.exercises.map(
            (ex: {
              name: string;
              exercise_type?: string;
              sort_order?: number;
              default_sets?: number;
              default_reps?: number;
              default_weight?: number;
              default_duration?: number;
              notes?: string;
            }) => ({
              templateId: id,
              name: ex.name,
              exerciseType: (ex.exercise_type as "strength" | "timed" | "cardio") || "strength",
              sortOrder: ex.sort_order ?? 0,
              defaultSets: ex.default_sets ?? null,
              defaultReps: ex.default_reps ?? null,
              defaultWeight: ex.default_weight?.toString() ?? null,
              defaultDuration: ex.default_duration ?? null,
              notes: ex.notes ?? null,
            })
          )
        );
      }
    }

    const result = await getTemplateWithExercises(id, userId);
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
      .delete(workoutTemplates)
      .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
