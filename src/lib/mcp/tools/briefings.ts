import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getTodayBriefing(userId: string) {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("daily_briefings")
    .select("*")
    .eq("user_id", userId)
    .eq("briefing_date", today)
    .single();

  return { data, error: error?.code === "PGRST116" ? null : (error?.message ?? null) };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerBriefingTools(server: McpServer) {
  // --- get_daily_briefing (READ) ---
  server.tool(
    "get_daily_briefing",
    "Get the AI-generated daily briefing for today",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "briefing:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTodayBriefing(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      if (!result.data) {
        return textResult({ message: "No briefing available for today. Generate one from the Daily Agent dashboard." });
      }

      return textResult(result.data);
    }
  );
}
