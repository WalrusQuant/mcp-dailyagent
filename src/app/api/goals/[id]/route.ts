import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

  const [goalResult, tasksResult, habitsResult] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("tasks")
      .select("*")
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("habits")
      .select("*")
      .eq("goal_id", id)
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("sort_order", { ascending: true }),
  ]);

  if (goalResult.error) {
    return NextResponse.json({ error: goalResult.error.message }, { status: 404 });
  }

  return NextResponse.json({
    ...goalResult.data,
    tasks: tasksResult.data ?? [],
    habits: habitsResult.data ?? [],
  });
}

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
  const allowedFields: Record<string, unknown> = {};

  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.description === "string" || body.description === null)
    allowedFields.description = body.description;
  if (typeof body.category === "string") allowedFields.category = body.category;
  if (typeof body.status === "string") allowedFields.status = body.status;
  if (typeof body.progress === "number") allowedFields.progress = body.progress;
  if (typeof body.progress_mode === "string") allowedFields.progress_mode = body.progress_mode;
  if (typeof body.target_date === "string" || body.target_date === null)
    allowedFields.target_date = body.target_date;
  if (typeof body.sort_order === "number") allowedFields.sort_order = body.sort_order;

  // Auto-set completed_at when marking completed
  if (body.status === "completed") {
    allowedFields.completed_at = new Date().toISOString();
  }
  if (body.status === "active") {
    allowedFields.completed_at = null;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("goals")
    .update(allowedFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

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
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
