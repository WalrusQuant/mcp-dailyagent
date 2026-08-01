import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeLog } from "@/lib/mcp/queries/workouts";
import { readJsonBody } from "@/lib/api-body";
import { isOwnedRelationship } from "@/lib/db/ownership";
import { calendarDateSchema, isOrderedDateRange, uuidSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (
    (date !== null && !calendarDateSchema.safeParse(date).success) ||
    (from !== null && !calendarDateSchema.safeParse(from).success) ||
    (to !== null && !calendarDateSchema.safeParse(to).success) ||
    !isOrderedDateRange(from ?? undefined, to ?? undefined)
  ) {
    return NextResponse.json({ error: "Invalid date or date range" }, { status: 400 });
  }

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
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, template_id, log_date, duration_minutes, notes, exercises } = body;

  if (!calendarDateSchema.safeParse(log_date).success) {
    return NextResponse.json({ error: "log_date is required and must be in YYYY-MM-DD format" }, { status: 400 });
  }
  if (template_id !== undefined && template_id !== null && !uuidSchema.safeParse(template_id).success) {
    return NextResponse.json({ error: "template_id must be a valid UUID" }, { status: 400 });
  }

  try {
    // Parent + children in one transaction so a failed exercise insert
    // doesn't leave an orphan log behind.
    const log = await db.transaction(async (tx) => {
      if (
        typeof template_id === "string" &&
        !(await isOwnedRelationship(tx, "workout_template", template_id, userId))
      ) {
        return null;
      }

      const [created] = await tx
        .insert(workoutLogs)
        .values({
          userId,
          name: (name as string) || "Workout",
          templateId: (template_id as string) ?? null,
          logDate: log_date as string,
          durationMinutes: (duration_minutes as number) ?? null,
          notes: (notes as string) ?? null,
        })
        .returning();

      if (Array.isArray(exercises) && exercises.length > 0) {
        await tx.insert(workoutLogExercises).values(
          exercises.map(
            (ex: {
              exercise_name: string;
              exercise_type?: string;
              sort_order?: number;
              sets?: Array<{ reps?: number; weight?: number; duration?: number }>;
            }) => ({
              logId: created.id,
              exerciseName: ex.exercise_name,
              exerciseType: ex.exercise_type || "strength",
              sortOrder: ex.sort_order ?? 0,
              sets: ex.sets || [],
            })
          )
        );
      }

      return created;
    });

    if (!log) {
      return NextResponse.json(
        { error: "template_id must reference one of your workout templates" },
        { status: 400 }
      );
    }

    const exRows = await db
      .select()
      .from(workoutLogExercises)
      .where(eq(workoutLogExercises.logId, log.id))
      .orderBy(workoutLogExercises.sortOrder);

    return NextResponse.json(serializeLog(log, exRows), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
