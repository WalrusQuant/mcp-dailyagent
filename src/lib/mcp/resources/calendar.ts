import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getDaySummary, getWeekSummary } from "@/lib/mcp/queries/calendar";
import { getToday } from "@/lib/dates";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerCalendarResources(server: McpServer) {
  // --- calendar-today ---
  server.resource(
    "calendar-today",
    "dailyagent://calendar/today",
    { description: "Detailed view of today: tasks, habits, journal, workouts, and focus sessions" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("calendar:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: calendar:read" }],
        };
      }

      const result = await getDaySummary(auth.userId, getToday());

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

  // --- calendar-week ---
  server.resource(
    "calendar-week",
    "dailyagent://calendar/week",
    { description: "Aggregated summary for the current week (Monday–Sunday)" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("calendar:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: calendar:read" }],
        };
      }

      const result = await getWeekSummary(auth.userId);

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
