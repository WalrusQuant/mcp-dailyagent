import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth, checkScope } from "@/lib/mcp/tools/helpers";
import { getSpaces } from "@/lib/mcp/queries/spaces";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerSpaceResources(server: McpServer) {
  // --- spaces-list ---
  server.resource(
    "spaces-list",
    "dailyagent://spaces",
    { description: "All spaces (projects), ordered by last updated" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      const scopeError = checkScope(auth.scopes, "spaces:read");
      if (scopeError) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: scopeError }],
        };
      }

      const result = await getSpaces(auth.userId);

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
