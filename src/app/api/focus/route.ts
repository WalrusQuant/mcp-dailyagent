import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET focus sessions with optional date range filter
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  const from = searchParams.get("from") || defaultFrom.toISOString();
  const to = searchParams.get("to") || new Date().toISOString();

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create a new focus session
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { task_id, duration_minutes, break_minutes, notes } = body;

  if (typeof duration_minutes !== "number" || duration_minutes <= 0) {
    return NextResponse.json(
      { error: "duration_minutes must be a positive number" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      user_id: user.id,
      task_id: task_id ?? null,
      duration_minutes,
      break_minutes: typeof break_minutes === "number" ? break_minutes : 0,
      notes: notes ?? null,
      started_at: new Date().toISOString(),
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
