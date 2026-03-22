import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const projectId = searchParams.get("space_id");

  const today = new Date().toISOString().split("T")[0];
  const taskDate = dateParam || today;

  // For today's view: also include any incomplete tasks from previous days
  // so they persist until completed or deleted (no manual rollover needed)
  if (taskDate === today) {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .or(`task_date.eq.${taskDate},and(task_date.lt.${taskDate},done.eq.false)`)
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true });

    if (projectId) {
      query = query.eq("space_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  // For past/future dates: show only that day's tasks
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("task_date", taskDate)
    .order("priority", { ascending: true })
    .order("sort_order", { ascending: true });

  if (projectId) {
    query = query.eq("space_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, notes, priority, task_date, space_id, goal_id, recurrence, sort_order } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      notes: notes || null,
      priority: typeof priority === "string" ? priority : "B1",
      task_date: task_date || today,
      space_id: space_id || null,
      goal_id: goal_id || null,
      recurrence: recurrence || null,
      sort_order: typeof sort_order === "number" ? sort_order : 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
