import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { insightCache } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

const insightsPayloadSchema = z.union([
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTodayInsights(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  try {
    const rows = await db
      .select()
      .from(insightCache)
      .where(and(eq(insightCache.userId, userId), eq(insightCache.cacheDate, today)));
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function saveInsights(userId: string, cacheDate: string, insights: unknown) {
  try {
    const [row] = await db
      .insert(insightCache)
      .values({
        userId,
        cacheDate,
        insights,
        source: "mcp",
      })
      .onConflictDoUpdate({
        target: [insightCache.userId, insightCache.cacheDate],
        set: {
          insights,
          source: "mcp",
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

export function registerInsightTools(server: McpServer) {
  // --- get_insights (READ) ---
  server.tool(
    "get_insights",
    "Get today's cached insights",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "insights:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTodayInsights(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      if (!result.data) {
        return textResult({ message: "No insights saved for today." });
      }

      return textResult(result.data);
    }
  );

  // --- save_insights (WRITE) ---
  server.tool(
    "save_insights",
    "Save or overwrite insights for a given date. Insights is an arbitrary JSON value (typically an array of insight objects).",
    {
      cache_date: dateSchema.optional().describe("Cache date in YYYY-MM-DD format (defaults to today)"),
      insights: insightsPayloadSchema.describe("Insight payload — must be a JSON array or object (not null/undefined). Typically an array of insight objects."),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "insights:write");
      if (scopeError) return errorResult(scopeError);

      const date = args.cache_date ?? new Date().toISOString().split("T")[0];
      const result = await saveInsights(auth.userId, date, args.insights);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
