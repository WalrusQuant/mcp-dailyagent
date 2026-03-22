import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET workout logs with optional date filtering
// ?date=YYYY-MM-DD   — exact day
// ?from=YYYY-MM-DD&to=YYYY-MM-DD — inclusive range
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("user_id", user.id)
    .order("log_date", { ascending: false });

  if (date) {
    query = query.eq("log_date", date);
  } else {
    if (from) query = query.gte("log_date", from);
    if (to) query = query.lte("log_date", to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create a new workout log with exercises
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, template_id, log_date, duration_minutes, notes, exercises } = body;

  if (!log_date || typeof log_date !== "string") {
    return NextResponse.json({ error: "log_date is required" }, { status: 400 });
  }

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .insert({
      user_id: user.id,
      name: name || "Workout",
      template_id: template_id ?? null,
      log_date,
      duration_minutes: duration_minutes ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  if (Array.isArray(exercises) && exercises.length > 0) {
    const exerciseRows = exercises.map(
      (ex: {
        exercise_name: string;
        exercise_type?: string;
        sort_order?: number;
        sets?: Array<{
          reps?: number;
          weight?: number;
          duration?: number;
        }>;
      }) => ({
        log_id: log.id,
        exercise_name: ex.exercise_name,
        exercise_type: ex.exercise_type || "strength",
        sort_order: ex.sort_order ?? 0,
        sets: ex.sets || [],
      })
    );

    const { error: exerciseError } = await supabase
      .from("workout_log_exercises")
      .insert(exerciseRows);

    if (exerciseError) {
      return NextResponse.json({ error: exerciseError.message }, { status: 500 });
    }
  }

  const { data: result, error: fetchError } = await supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("id", log.id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json(result, { status: 201 });
}
