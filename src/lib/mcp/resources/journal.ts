import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAuth } from "@/lib/mcp/tools/helpers";
import { getJournalEntry, getRecentJournalEntries } from "@/lib/mcp/queries/journal";
import { getToday } from "@/lib/dates";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerJournalResources(server: McpServer) {
  // --- journal-today ---
  server.resource(
    "journal-today",
    "dailyagent://journal/today",
    { description: "Today's journal entry, or null if none has been written" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("journal:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: journal:read" }],
        };
      }

      const result = await getJournalEntry(auth.userId, getToday());

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

  // --- journal-recent ---
  server.resource(
    "journal-recent",
    "dailyagent://journal/recent",
    { description: "The 7 most recent journal entries, newest first" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("journal:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: journal:read" }],
        };
      }

      const result = await getRecentJournalEntries(auth.userId, 7);

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
