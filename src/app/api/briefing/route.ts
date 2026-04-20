import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { dailyBriefings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = getUserId();
    const today = new Date().toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(dailyBriefings)
      .where(and(eq(dailyBriefings.userId, userId), eq(dailyBriefings.briefingDate, today)));

    const row = rows[0];
    return NextResponse.json({
      content: row?.content ?? null,
      briefing_date: row?.briefingDate ?? today,
      updated_at: row?.updatedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
