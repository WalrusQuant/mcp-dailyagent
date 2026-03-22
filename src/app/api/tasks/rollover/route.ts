import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  void request;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: undoneTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .lt("task_date", todayStr)
    .eq("done", false)
    .is("rolled_from", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!undoneTasks || undoneTasks.length === 0) {
    return NextResponse.json([]);
  }

  const newTasks = undoneTasks.map((task) => ({
    user_id: user.id,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    task_date: todayStr,
    space_id: task.space_id,
    recurrence: task.recurrence,
    sort_order: task.sort_order,
    rolled_from: task.id,
  }));

  const { data: created, error: insertError } = await supabase
    .from("tasks")
    .insert(newTasks)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Mark originals as done so they don't show up in future rollover checks
  const originalIds = undoneTasks.map((t) => t.id);
  await supabase
    .from("tasks")
    .update({ done: true })
    .in("id", originalIds);

  return NextResponse.json(created);
}
