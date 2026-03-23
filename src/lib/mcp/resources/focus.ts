import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getTodayFocusStats } from "@/lib/mcp/queries/focus";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerFocusResources(server: McpServer) {
  // --- focus-today ---
  server.resource(
    "focus-today",
    "dailyagent://focus/today",
    { description: "Today's focus session totals: total minutes and session count" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("focus:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: focus:read" }],
        };
      }

      const supabase = getServiceClient();
      const result = await getTodayFocusStats(supabase, auth.userId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data ?? { totalMinutes: 0, sessionCount: 0 }),
          },
        ],
      };
    }
  );
}
