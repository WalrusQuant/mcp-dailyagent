import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tasks } = body;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "tasks must be a non-empty array" }, { status: 400 });
  }

  for (const item of tasks) {
    if (typeof item.id !== "string" || typeof item.sort_order !== "number") {
      return NextResponse.json(
        { error: "Each task must have a string id and numeric sort_order" },
        { status: 400 }
      );
    }
  }

  const taskIds = tasks.map((t: { id: string }) => t.id);
  const sortOrders = tasks.map((t: { sort_order: number }) => t.sort_order);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)("reorder_tasks", {
    task_ids: taskIds,
    sort_orders: sortOrders,
    p_user_id: user.id,
  });

  if (error) {
    console.error("Task reorder error:", error);
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
