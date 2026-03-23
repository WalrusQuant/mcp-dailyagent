import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth } from "@/lib/mcp/tools/helpers";
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

      if (!auth.scopes.includes("workouts:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: workouts:read" }],
        };
      }

      const supabase = getServiceClient();
      const today = getToday();
      const from = addDays(today, -7);
      const result = await getWorkoutLogs(supabase, auth.userId, { from, to: today });

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
