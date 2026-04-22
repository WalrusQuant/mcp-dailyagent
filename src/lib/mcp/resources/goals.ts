import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
import { getGoals } from "@/lib/mcp/queries/goals";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerGoalResources(server: McpServer) {
  // --- goals-active ---
  server.resource(
    "goals-active",
    "dailyagent://goals/active",
    { description: "All active goals, ordered by sort order and creation date" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "goals:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getGoals(auth.userId, "active");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data ?? []),
          },
        ],
      };
    }
  );
}
