import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all workout templates for the current user with their exercises
export async function GET() {
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
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create a new workout template with exercises
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, exercises } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: template, error: templateError } = await supabase
    .from("workout_templates")
    .insert({ user_id: user.id, name, description: description ?? null })
    .select()
    .single();

  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 500 });
  }

  if (Array.isArray(exercises) && exercises.length > 0) {
    const exerciseRows = exercises.map(
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
        template_id: template.id,
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

    const { error: exerciseError } = await supabase
      .from("workout_exercises")
      .insert(exerciseRows);

    if (exerciseError) {
      return NextResponse.json({ error: exerciseError.message }, { status: 500 });
    }
  }

  const { data: result, error: fetchError } = await supabase
    .from("workout_templates")
    .select("*, workout_exercises(*)")
    .eq("id", template.id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json(result, { status: 201 });
}
