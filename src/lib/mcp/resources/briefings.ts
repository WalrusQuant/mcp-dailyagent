import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
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

      const scopeError = checkScope(auth.scopes, "briefing:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getTodayBriefing(auth.userId);

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
