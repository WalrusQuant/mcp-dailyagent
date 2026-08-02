import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
import { getTodayBriefing } from "@/lib/mcp/queries/briefings";
import type { Extra } from "@/lib/mcp/tools/helpers";
import { getProfileCapabilities } from "@/lib/profile-capabilities";

export function registerBriefingResources(server: McpServer) {
  // --- briefing-today ---
  server.resource(
    "briefing-today",
    "cadence://briefing/today",
    { description: "Today's saved daily briefing, if one exists" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "briefing:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }
      if (!(await getProfileCapabilities(auth.userId)).briefingEnabled) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Daily briefings are disabled in profile settings" }],
        };
      }

      const result = await getTodayBriefing(auth.userId);
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
