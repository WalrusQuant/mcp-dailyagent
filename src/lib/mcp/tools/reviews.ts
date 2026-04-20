import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { weeklyReviews } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getReviewForWeek(userId: string, weekStart: string) {
  try {
    const rows = await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)));
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getLatestReview(userId: string) {
  try {
    const rows = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.weekStart))
      .limit(1);
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function saveReview(userId: string, weekStart: string, content: string) {
  try {
    const [row] = await db
      .insert(weeklyReviews)
      .values({
        userId,
        weekStart,
        content,
        source: "mcp",
      })
      .onConflictDoUpdate({
        target: [weeklyReviews.userId, weeklyReviews.weekStart],
        set: {
          content,
          source: "mcp",
          updatedAt: new Date(),
        },
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerReviewTools(server: McpServer) {
  // --- get_weekly_review (READ) ---
  server.tool(
    "get_weekly_review",
    "Get a weekly review. If week_start is provided, fetches that specific week; otherwise returns the latest review.",
    {
      week_start: dateSchema.optional().describe("Week start date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "review:read");
      if (scopeError) return errorResult(scopeError);

      const result = args.week_start
        ? await getReviewForWeek(auth.userId, args.week_start)
        : await getLatestReview(auth.userId);

      if (result.error) return errorResult(`Error: ${result.error}`);

      if (!result.data) {
        return textResult({ message: "No weekly review found." });
      }

      return textResult(result.data);
    }
  );

  // --- save_weekly_review (WRITE) ---
  server.tool(
    "save_weekly_review",
    "Save or overwrite a weekly review for a given week",
    {
      week_start: dateSchema.describe("Week start date in YYYY-MM-DD format"),
      content: z.string().describe("Review content (markdown supported)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "review:write");
      if (scopeError) return errorResult(scopeError);

      const result = await saveReview(auth.userId, args.week_start, args.content);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
