import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function getNextOccurrence(taskDate: string, recurrence: { type: string; days?: number[] }): string {
  const d = new Date(taskDate + "T00:00:00");
  switch (recurrence.type) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekdays": {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      break;
    }
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

export async function GET(
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

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
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
  if (typeof body.notes === "string" || body.notes === null) allowedFields.notes = body.notes;
  if (typeof body.priority === "number") allowedFields.priority = body.priority;
  if (typeof body.sort_order === "number") allowedFields.sort_order = body.sort_order;
  if (typeof body.done === "boolean") allowedFields.done = body.done;
  if (typeof body.done_at === "string" || body.done_at === null) allowedFields.done_at = body.done_at;
  if (typeof body.task_date === "string") allowedFields.task_date = body.task_date;
  if (typeof body.space_id === "string" || body.space_id === null)
    allowedFields.space_id = body.space_id;
  if (typeof body.goal_id === "string" || body.goal_id === null)
    allowedFields.goal_id = body.goal_id;
  if (body.recurrence !== undefined) allowedFields.recurrence = body.recurrence;

  // Auto-set done_at when marking done
  if (body.done === true && body.done_at === undefined) {
    allowedFields.done_at = new Date().toISOString();
  }
  if (body.done === false) {
    allowedFields.done_at = null;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .update(allowedFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If marking done and task has recurrence, create next occurrence
  if (body.done === true && data.recurrence && data.task_date) {
    const nextDate = getNextOccurrence(data.task_date, data.recurrence);

    await supabase.from("tasks").insert({
      user_id: user.id,
      title: data.title,
      notes: data.notes,
      priority: data.priority,
      task_date: nextDate,
      space_id: data.space_id,
      recurrence: data.recurrence,
      sort_order: data.sort_order,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(
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

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
