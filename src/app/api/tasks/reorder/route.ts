import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-body";
import { reorderTasksAggregate, TaskMutationError } from "@/lib/tasks/mutations";

export async function PATCH(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { tasks: taskItems } = body;

  if (!Array.isArray(taskItems) || taskItems.length === 0) {
    return NextResponse.json({ error: "tasks must be a non-empty array" }, { status: 400 });
  }

  for (const item of taskItems) {
    if (typeof item.id !== "string" || typeof item.sort_order !== "number") {
      return NextResponse.json(
        { error: "Each task must have a string id and numeric sort_order" },
        { status: 400 }
      );
    }
  }

  try {
    await reorderTasksAggregate(
      userId,
      (taskItems as { id: string; sort_order: number }[]).map((item) => ({
        id: item.id,
        sortOrder: item.sort_order,
      }))
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TaskMutationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Task reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }
}
