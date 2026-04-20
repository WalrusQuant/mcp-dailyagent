import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
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
    await db.transaction(async (tx) => {
      for (const item of taskItems as { id: string; sort_order: number }[]) {
        await tx
          .update(tasks)
          .set({ sortOrder: item.sort_order })
          .where(and(eq(tasks.id, item.id), eq(tasks.userId, userId)));
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Task reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }
}
