import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { goalProgressLogs } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeLog(l: typeof goalProgressLogs.$inferSelect) {
  return {
    id: l.id,
    goal_id: l.goalId,
    user_id: l.userId,
    log_date: l.logDate,
    progress: l.progress,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const rows = await db
      .select()
      .from(goalProgressLogs)
      .where(and(eq(goalProgressLogs.goalId, id), eq(goalProgressLogs.userId, userId)))
      .orderBy(asc(goalProgressLogs.logDate));

    return NextResponse.json(rows.map(serializeLog));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
