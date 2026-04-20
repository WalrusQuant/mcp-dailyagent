import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { dailyBriefings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTodayBriefing(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  try {
    const rows = await db
      .select()
      .from(dailyBriefings)
      .where(and(eq(dailyBriefings.userId, userId), eq(dailyBriefings.briefingDate, today)));
    return { data: rows.length > 0 ? rows[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function saveBriefing(userId: string, briefingDate: string, content: string) {
  try {
    const [row] = await db
      .insert(dailyBriefings)
      .values({
        userId,
        briefingDate,
        content,
        source: "mcp",
      })
      .onConflictDoUpdate({
        target: [dailyBriefings.userId, dailyBriefings.briefingDate],
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

export function registerBriefingTools(server: McpServer) {
  // --- get_daily_briefing (READ) ---
  server.tool(
    "get_daily_briefing",
    "Get the daily briefing for today",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "briefing:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTodayBriefing(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      if (!result.data) {
        return textResult({ message: "No briefing saved for today." });
      }

      return textResult(result.data);
    }
  );

  // --- save_daily_briefing (WRITE) ---
  server.tool(
    "save_daily_briefing",
    "Save or overwrite the daily briefing for a given date. If date is omitted, uses today.",
    {
      briefing_date: dateSchema.optional().describe("Briefing date in YYYY-MM-DD format (defaults to today)"),
      content: z.string().describe("Briefing content (markdown supported)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "briefing:write");
      if (scopeError) return errorResult(scopeError);

      const date = args.briefing_date ?? new Date().toISOString().split("T")[0];
      const result = await saveBriefing(auth.userId, date, args.content);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
