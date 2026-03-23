import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, PAID_PLAN_REQUIRED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getReviewForWeek(userId: string, weekStart: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .single();

  return { data, error: error?.code === "PGRST116" ? null : (error?.message ?? null) };
}

async function getLatestReview(userId: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  return { data, error: error?.code === "PGRST116" ? null : (error?.message ?? null) };
}

async function saveReview(userId: string, weekStart: string, content: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
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
      week_start: z.string().optional().describe("Week start date in YYYY-MM-DD format"),
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
      week_start: z.string().describe("Week start date in YYYY-MM-DD format"),
      content: z.string().describe("Review content (markdown supported)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "review:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await saveReview(auth.userId, args.week_start, args.content);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
