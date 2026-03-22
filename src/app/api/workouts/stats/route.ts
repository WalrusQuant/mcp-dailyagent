import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface SetData {
  reps?: number;
  weight?: number;
}

interface LogExercise {
  exercise_name: string;
  sets?: SetData[] | null;
}

interface WorkoutLog {
  workout_log_exercises: LogExercise[];
}

// GET workout stats for the current user
// ?days=30 — look-back window in days (default 30)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get("days") || "30", 10));

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().split("T")[0];

  const { data: logs, error } = await supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("user_id", user.id)
    .gte("log_date", sinceDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalWorkouts = logs.length;

  // Aggregate volume and personal records across all logs
  let totalVolume = 0;
  const prMap = new Map<string, { maxWeight: number; maxReps: number }>();

  for (const log of logs as unknown as WorkoutLog[]) {
    for (const exercise of log.workout_log_exercises) {
      if (!Array.isArray(exercise.sets)) continue;

      for (const set of exercise.sets) {
        const reps = set.reps ?? 0;
        const weight = set.weight ?? 0;

        totalVolume += weight * reps;

        const key = exercise.exercise_name.toLowerCase();
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
}
