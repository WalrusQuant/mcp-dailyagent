import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
import { getDaySummary, getWeekSummary } from "@/lib/mcp/queries/calendar";
import { getToday } from "@/lib/dates";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerCalendarResources(server: McpServer) {
  // --- calendar-today ---
  server.resource(
    "calendar-today",
    "cadence://calendar/today",
    { description: "Detailed view of today: tasks, habits, journal, workouts, and focus sessions" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "calendar:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getDaySummary(auth.userId, getToday());
      if (result.error) throw new Error(result.error);

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
    "cadence://calendar/week",
    { description: "Aggregated summary for the current week (Monday–Sunday)" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "calendar:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getWeekSummary(auth.userId);
      if (result.error) throw new Error(result.error);

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
