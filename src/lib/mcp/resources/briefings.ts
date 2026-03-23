import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getTodayBriefing } from "@/lib/mcp/queries/briefings";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerBriefingResources(server: McpServer) {
  // --- briefing-today ---
  server.resource(
    "briefing-today",
    "dailyagent://briefing/today",
    { description: "Today's AI-generated daily briefing, if one has been generated" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("briefing:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: briefing:read" }],
        };
      }

      const supabase = getServiceClient();
      const result = await getTodayBriefing(supabase, auth.userId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data ?? null),
          },
        ],
      };
    }
  );
}
