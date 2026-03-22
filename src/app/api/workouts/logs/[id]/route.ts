import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET a single workout log with its exercises
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH update a workout log; optionally replace exercises
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Whitelist scalar fields
  const allowedFields: Record<string, unknown> = {};
  if (typeof body.name === "string" || body.name === null)
    allowedFields.name = body.name;
  if (typeof body.log_date === "string") allowedFields.log_date = body.log_date;
  if (typeof body.duration_minutes === "number" || body.duration_minutes === null)
    allowedFields.duration_minutes = body.duration_minutes;
  if (typeof body.notes === "string" || body.notes === null)
    allowedFields.notes = body.notes;

  if (Object.keys(allowedFields).length === 0 && !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (Object.keys(allowedFields).length > 0) {
    const { error: updateError } = await supabase
      .from("workout_logs")
      .update(allowedFields)
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.exercises)) {
    const { error: deleteError } = await supabase
      .from("workout_log_exercises")
      .delete()
      .eq("log_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (body.exercises.length > 0) {
      const exerciseRows = body.exercises.map(
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
          log_id: id,
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type ?? null,
          sort_order: ex.sort_order ?? 0,
          sets: ex.sets ?? null,
        })
      );

      const { error: insertError } = await supabase
        .from("workout_log_exercises")
        .insert(exerciseRows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("workout_logs")
    .select("*, workout_log_exercises(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE a workout log (exercises cascade via FK)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
