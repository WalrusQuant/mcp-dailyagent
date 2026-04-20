import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { weeklyReviews } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeReview(r: typeof weeklyReviews.$inferSelect) {
  return {
    id: r.id,
    user_id: r.userId,
    week_start: r.weekStart,
    content: r.content,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");

  if (!week) {
    return NextResponse.json(
      { error: "week query parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const rows = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, week)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(serializeReview(rows[0]));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
