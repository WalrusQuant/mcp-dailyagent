import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getLatestReview } from "@/lib/mcp/queries/reviews";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerReviewResources(server: McpServer) {
  // --- review-latest ---
  server.resource(
    "review-latest",
    "dailyagent://review/latest",
    { description: "The most recent weekly review, or null if none exists" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("review:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: review:read" }],
        };
      }

      const supabase = getServiceClient();
      const result = await getLatestReview(supabase, auth.userId);

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
