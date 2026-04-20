import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { insightCache } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = getUserId();
    const today = new Date().toISOString().split("T")[0];

    const rows = await db
      .select()
      .from(insightCache)
      .where(and(eq(insightCache.userId, userId), eq(insightCache.cacheDate, today)));

    const row = rows[0];
    return NextResponse.json({
      insights: row?.insights ?? [],
      cache_date: row?.cacheDate ?? today,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
