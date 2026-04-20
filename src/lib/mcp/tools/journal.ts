import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, ilike } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getJournalEntry(userId: string, date: string) {
  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, date)));

    return { data: rows.length > 0 ? rows[0] : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getRecentJournalEntries(userId: string, from?: string, to?: string, limit = 10) {
  try {
    let query = db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.entryDate))
      .limit(limit);

    if (from && to) {
      query = db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), gte(journalEntries.entryDate, from), lte(journalEntries.entryDate, to)))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit);
    } else if (from) {
      query = db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), gte(journalEntries.entryDate, from)))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit);
    } else if (to) {
      query = db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), lte(journalEntries.entryDate, to)))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit);
    }

    const rows = await query;
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function searchJournal(userId: string, query: string) {
  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          ilike(journalEntries.content, `%${query}%`)
        )
      )
      .orderBy(desc(journalEntries.entryDate))
      .limit(20);

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function createOrUpdateJournalEntry(
  userId: string,
  args: {
    content: string;
    entry_date?: string;
    mood?: number;
  }
) {
  const today = new Date().toISOString().split("T")[0];
  const entryDate = args.entry_date ?? today;

  try {
    const [row] = await db
      .insert(journalEntries)
      .values({
        userId,
        entryDate,
        content: args.content,
        mood: args.mood ?? null,
      })
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.entryDate],
        set: {
          content: args.content,
          mood: args.mood ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
      date: dateSchema.optional().describe("Specific date in YYYY-MM-DD format"),
      from: dateSchema.optional().describe("Start date in YYYY-MM-DD format for a range"),
      to: dateSchema.optional().describe("End date in YYYY-MM-DD format for a range"),
      limit: z.number().int().min(1).max(100).optional().describe("Maximum number of entries to return (default: 10)"),
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
      entry_date: dateSchema.optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
      mood: z.number().int().min(1).max(5).optional().describe("Mood rating from 1 (low) to 5 (great)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "journal:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createOrUpdateJournalEntry(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
