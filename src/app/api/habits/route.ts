import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all habits for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "true";

  let query = supabase
    .from("habits")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new habit
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, frequency, target_days, color, sort_order, goal_id } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: name.trim(),
      ...(description ? { description } : {}),
      ...(frequency ? { frequency } : {}),
      ...(target_days ? { target_days } : {}),
      ...(color ? { color } : {}),
      ...(typeof sort_order === "number" ? { sort_order } : {}),
      ...(goal_id !== undefined ? { goal_id: goal_id || null } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
