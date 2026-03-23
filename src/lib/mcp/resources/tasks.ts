import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getTasksForDate, getOverdueTasks } from "@/lib/mcp/queries/tasks";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerTaskResources(server: McpServer) {
  // --- tasks-today ---
  server.resource(
    "tasks-today",
    "dailyagent://tasks/today",
    { description: "Today's tasks, including any incomplete tasks from previous days" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("tasks:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: tasks:read" }],
        };
      }

      const supabase = getServiceClient();
      const result = await getTasksForDate(supabase, auth.userId);

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

  // --- tasks-overdue ---
  server.resource(
    "tasks-overdue",
    "dailyagent://tasks/overdue",
    { description: "Incomplete tasks with a date before today" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("tasks:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: tasks:read" }],
        };
      }

      const supabase = getServiceClient();
      const result = await getOverdueTasks(supabase, auth.userId);

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
