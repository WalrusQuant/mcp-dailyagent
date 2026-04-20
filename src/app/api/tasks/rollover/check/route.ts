import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const userId = getUserId();

  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          lt(tasks.taskDate, todayStr),
          eq(tasks.done, false),
          isNull(tasks.rolledFrom)
        )
      );

    return NextResponse.json({ count: result[0]?.count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
