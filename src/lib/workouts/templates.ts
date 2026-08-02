import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workoutExercises, workoutTemplates } from "@/lib/db/schema";
import { serializeTemplate } from "@/lib/mcp/queries/workouts";

export type TemplateExerciseInput = {
  name: string;
  exercise_type?: "strength" | "timed" | "cardio";
  sort_order?: number;
  default_sets?: number | null;
  default_reps?: number | null;
  default_weight?: number | null;
  default_duration?: number | null;
  notes?: string | null;
};

export async function updateWorkoutTemplate(
  userId: string,
  templateId: string,
  input: { name?: string; description?: string | null; exercises?: TemplateExerciseInput[] }
) {
  return db.transaction(async (tx) => {
    const [owned] = await tx.select().from(workoutTemplates).where(and(
      eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)
    ));
    if (!owned) return null;

    const patch: Partial<typeof workoutTemplates.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    let template = owned;
    if (Object.keys(patch).length) {
      [template] = await tx.update(workoutTemplates).set(patch).where(and(
        eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)
      )).returning();
    }

    if (input.exercises !== undefined) {
      await tx.delete(workoutExercises).where(eq(workoutExercises.templateId, templateId));
      if (input.exercises.length) {
        await tx.insert(workoutExercises).values(input.exercises.map((exercise, index) => ({
          templateId,
          name: exercise.name,
          exerciseType: exercise.exercise_type ?? "strength",
          sortOrder: exercise.sort_order ?? index,
          defaultSets: exercise.default_sets ?? null,
          defaultReps: exercise.default_reps ?? null,
          defaultWeight: exercise.default_weight == null ? null : String(exercise.default_weight),
          defaultDuration: exercise.default_duration ?? null,
          notes: exercise.notes ?? null,
        })));
      }
    }

    const exercises = await tx.select().from(workoutExercises)
      .where(eq(workoutExercises.templateId, templateId)).orderBy(workoutExercises.sortOrder);
    return serializeTemplate(template, exercises);
  });
}
