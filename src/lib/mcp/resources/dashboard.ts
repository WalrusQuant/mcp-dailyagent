import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScopes } from "@/lib/mcp/tools/helpers";
import { getDashboardSnapshot } from "@/lib/mcp/queries/dashboard";
import type { Extra } from "@/lib/mcp/tools/helpers";

// The dashboard aggregates data from all productivity domains.
const DASHBOARD_SCOPES = [
  "tasks:read",
  "habits:read",
  "journal:read",
  "workouts:read",
  "focus:read",
  "goals:read",
];

export function registerDashboardResources(server: McpServer) {
  // --- dashboard ---
  server.resource(
    "dashboard",
    "cadence://dashboard",
    { description: "Today's aggregated productivity snapshot: tasks, habits, journal, workouts, focus, and goals" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScopes(auth.scopes, DASHBOARD_SCOPES);
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getDashboardSnapshot(auth.userId);
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
