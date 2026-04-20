import { db } from "@/lib/db/client";
import { dailyBriefings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface DailyBriefing {
  id: string;
  user_id: string;
  briefing_date: string;
  content: string;
  created_at: string;
}

/** Get today's cached daily briefing, if it exists */
export async function getTodayBriefing(
  userId: string
): Promise<QueryResult<DailyBriefing | null>> {
  try {
    const today = getToday();

    const rows = await db
      .select()
      .from(dailyBriefings)
      .where(and(eq(dailyBriefings.userId, userId), eq(dailyBriefings.briefingDate, today)));

    if (rows.length === 0) return { data: null, error: null };

    const row = rows[0];
    return {
      data: {
        id: row.id,
        user_id: row.userId,
        briefing_date: row.briefingDate,
        content: row.content,
        created_at: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

