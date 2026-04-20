import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getDashboardSnapshot } from "@/lib/mcp/queries/dashboard";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerDashboardResources(server: McpServer) {
  // --- dashboard ---
  server.resource(
    "dashboard",
    "dailyagent://dashboard",
    { description: "Today's aggregated productivity snapshot: tasks, habits, journal, workouts, focus, and goals" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      // Dashboard is accessible to any authenticated user — no specific scope required
      const result = await getDashboardSnapshot(auth.userId);

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
