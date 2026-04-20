import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutLogs, workoutLogExercises } from "@/lib/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

interface SetData {
  reps?: number;
  weight?: number;
}

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "30", 10));

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().split("T")[0];

  try {
    const logs = await db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), gte(workoutLogs.logDate, sinceDate)));

    if (logs.length === 0) {
      return NextResponse.json({
        totalWorkouts: 0,
        totalVolume: 0,
        weeklyAverage: 0,
        personalRecords: [],
      });
    }

    const logIds = logs.map((l) => l.id);
    const exercises = await db
      .select()
      .from(workoutLogExercises)
      .where(
        logIds.length === 1
          ? eq(workoutLogExercises.logId, logIds[0])
          : inArray(workoutLogExercises.logId, logIds)
      );

    const exercisesByLog: Record<string, typeof workoutLogExercises.$inferSelect[]> = {};
    for (const ex of exercises) {
      if (!exercisesByLog[ex.logId]) exercisesByLog[ex.logId] = [];
      exercisesByLog[ex.logId].push(ex);
    }

    const totalWorkouts = logs.length;
    let totalVolume = 0;
    const prMap = new Map<string, { maxWeight: number; maxReps: number }>();

    for (const log of logs) {
      for (const exercise of exercisesByLog[log.id] ?? []) {
        const sets = exercise.sets as SetData[] | null;
        if (!Array.isArray(sets)) continue;

        for (const set of sets) {
          const reps = set.reps ?? 0;
          const weight = set.weight ?? 0;

          totalVolume += weight * reps;

          const key = exercise.exerciseName.toLowerCase();
          const current = prMap.get(key);

          if (!current) {
            prMap.set(key, { maxWeight: weight, maxReps: reps });
          } else {
            if (weight > current.maxWeight) current.maxWeight = weight;
            if (reps > current.maxReps) current.maxReps = reps;
          }
        }
      }
    }

    const weeks = days / 7;
    const weeklyAverage = weeks > 0 ? totalWorkouts / weeks : 0;

    const personalRecords = Array.from(prMap.entries()).map(([exercise, pr]) => ({
      exercise,
      maxWeight: pr.maxWeight,
      maxReps: pr.maxReps,
    }));

    return NextResponse.json({
      totalWorkouts,
      totalVolume,
      weeklyAverage: Math.round(weeklyAverage * 100) / 100,
      personalRecords,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
