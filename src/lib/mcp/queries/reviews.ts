import { db } from "@/lib/db/client";
import { weeklyReviews } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function rowToReview(row: typeof weeklyReviews.$inferSelect): WeeklyReview {
  return {
    id: row.id,
    user_id: row.userId,
    week_start: row.weekStart,
    content: row.content,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Get the most recent weekly review */
export async function getLatestReview(
  userId: string
): Promise<QueryResult<WeeklyReview | null>> {
  try {
    const rows = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.weekStart))
      .limit(1);

    return { data: rows.length > 0 ? rowToReview(rows[0]) : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Get the weekly review for a specific week */
export async function getReviewForWeek(
  userId: string,
  weekStart: string
): Promise<QueryResult<WeeklyReview | null>> {
  try {
    const rows = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)));

    return { data: rows.length > 0 ? rowToReview(rows[0]) : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface SaveReviewInput {
  week_start: string;
  content: string;
}

export async function saveReview(
  userId: string,
  input: SaveReviewInput
): Promise<QueryResult<WeeklyReview>> {
  try {
    const [row] = await db
      .insert(weeklyReviews)
      .values({
        userId,
        weekStart: input.week_start,
        content: input.content,
      })
      .onConflictDoUpdate({
        target: [weeklyReviews.userId, weeklyReviews.weekStart],
        set: {
          content: input.content,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { data: rowToReview(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
