import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { getAuth } from "@/lib/mcp/tools/helpers";
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

      if (!auth.scopes.includes("goals:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: goals:read" }],
        };
      }

      const result = await getGoals(db, auth.userId, "active");

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
