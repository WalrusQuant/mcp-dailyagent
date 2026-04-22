import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTemplate } from "@/lib/mcp/queries/workouts";

export async function GET() {
  const userId = getUserId();

  try {
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId))
      .orderBy(desc(workoutTemplates.createdAt));

    if (templates.length === 0) {
      return NextResponse.json([]);
    }

    const templateIds = templates.map((t) => t.id);
    const exercises = await db
      .select()
      .from(workoutExercises)
      .where(
        templateIds.length === 1
          ? eq(workoutExercises.templateId, templateIds[0])
          : inArray(workoutExercises.templateId, templateIds)
      )
      .orderBy(workoutExercises.sortOrder);

    const exercisesByTemplate: Record<string, typeof workoutExercises.$inferSelect[]> = {};
    for (const ex of exercises) {
      if (!exercisesByTemplate[ex.templateId]) exercisesByTemplate[ex.templateId] = [];
      exercisesByTemplate[ex.templateId].push(ex);
    }

    return NextResponse.json(
      templates.map((t) => serializeTemplate(t, exercisesByTemplate[t.id] ?? []))
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { name, description, exercises } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const [template] = await db
      .insert(workoutTemplates)
      .values({ userId, name, description: description ?? null })
      .returning();

    if (Array.isArray(exercises) && exercises.length > 0) {
      await db.insert(workoutExercises).values(
        exercises.map(
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
            templateId: template.id,
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

    const exRows = await db
      .select()
      .from(workoutExercises)
      .where(eq(workoutExercises.templateId, template.id))
      .orderBy(workoutExercises.sortOrder);

    return NextResponse.json(serializeTemplate(template, exRows), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
