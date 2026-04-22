import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
import { getWorkoutLogs } from "@/lib/mcp/queries/workouts";
import { getToday, addDays } from "@/lib/dates";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerWorkoutResources(server: McpServer) {
  // --- workouts-recent ---
  server.resource(
    "workouts-recent",
    "dailyagent://workouts/recent",
    { description: "Workout logs from the last 7 days, newest first" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "workouts:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const today = getToday();
      const from = addDays(today, -7);
      const result = await getWorkoutLogs(auth.userId, { from, to: today });

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
