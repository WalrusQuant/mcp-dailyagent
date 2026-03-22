import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET a single workout template with its exercises
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
    .from("workout_templates")
    .select("*, workout_exercises(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH update a workout template; optionally replace exercises
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
  if (typeof body.name === "string") allowedFields.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;

  if (Object.keys(allowedFields).length === 0 && !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (Object.keys(allowedFields).length > 0) {
    const { error: updateError } = await supabase
      .from("workout_templates")
      .update(allowedFields)
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.exercises)) {
    const { error: deleteError } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("template_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (body.exercises.length > 0) {
      const exerciseRows = body.exercises.map(
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
          template_id: id,
          name: ex.name,
          exercise_type: (ex.exercise_type as "strength" | "timed" | "cardio") || "strength",
          sort_order: ex.sort_order ?? 0,
          default_sets: ex.default_sets ?? null,
          default_reps: ex.default_reps ?? null,
          default_weight: ex.default_weight ?? null,
          default_duration: ex.default_duration ?? null,
          notes: ex.notes ?? null,
        })
      );

      const { error: insertError } = await supabase
        .from("workout_exercises")
        .insert(exerciseRows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("workout_templates")
    .select("*, workout_exercises(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE a workout template (exercises cascade via FK)
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
    .from("workout_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
