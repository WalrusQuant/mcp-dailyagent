import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, PAID_PLAN_REQUIRED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getJournalEntry(userId: string, date: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .single();

  return { data, error: error?.code === "PGRST116" ? null : (error?.message ?? null) };
}

async function getRecentJournalEntries(userId: string, from?: string, to?: string, limit = 10) {
  const supabase = getServiceClient();

  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
}

async function searchJournal(userId: string, query: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .ilike("content", `%${query}%`)
    .order("entry_date", { ascending: false })
    .limit(20);

  return { data, error: error?.message ?? null };
}

async function createOrUpdateJournalEntry(
  userId: string,
  args: {
    content: string;
    entry_date?: string;
    mood?: number;
  }
) {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const entryDate = args.entry_date ?? today;

  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(
      {
        user_id: userId,
        entry_date: entryDate,
        content: args.content,
        mood: args.mood ?? null,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerJournalTools(server: McpServer) {
  // --- get_journal_entries (READ) ---
  server.tool(
    "get_journal_entries",
    "Get journal entries. Fetches a specific date or a range of entries.",
    {
      date: z.string().optional().describe("Specific date in YYYY-MM-DD format"),
      from: z.string().optional().describe("Start date in YYYY-MM-DD format for a range"),
      to: z.string().optional().describe("End date in YYYY-MM-DD format for a range"),
      limit: z.number().optional().describe("Maximum number of entries to return (default: 10)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "journal:read");
      if (scopeError) return errorResult(scopeError);

      if (args.date) {
        const result = await getJournalEntry(auth.userId, args.date);
        if (result.error) return errorResult(`Error: ${result.error}`);
        return textResult(result.data);
      }

      const result = await getRecentJournalEntries(auth.userId, args.from, args.to, args.limit ?? 10);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- search_journal (READ) ---
  server.tool(
    "search_journal",
    "Search journal entries by content",
    {
      query: z.string().describe("Search query text"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "journal:read");
      if (scopeError) return errorResult(scopeError);

      const result = await searchJournal(auth.userId, args.query);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_journal_entry (WRITE) ---
  server.tool(
    "create_journal_entry",
    "Create or update a journal entry for a given date (defaults to today)",
    {
      content: z.string().describe("Journal entry content"),
      entry_date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      mood: z.number().min(1).max(5).optional().describe("Mood rating from 1 (low) to 5 (great)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "journal:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await createOrUpdateJournalEntry(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
