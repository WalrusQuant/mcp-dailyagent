import { db } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export function serializeEntry(e: typeof journalEntries.$inferSelect) {
  return {
    id: e.id,
    user_id: e.userId,
    entry_date: e.entryDate,
    content: e.content,
    mood: e.mood,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

export interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  entry_date: string;
  mood: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrUpdateJournalInput {
  content: string;
  entry_date?: string;
  mood?: number | null;
}

function rowToEntry(row: typeof journalEntries.$inferSelect): JournalEntry {
  return {
    id: row.id,
    user_id: row.userId,
    content: row.content,
    entry_date: row.entryDate,
    mood: row.mood ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getJournalEntry(
  userId: string,
  date: string
): Promise<QueryResult<JournalEntry | null>> {
  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, date)));

    return { data: rows.length > 0 ? rowToEntry(rows[0]) : null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getRecentJournalEntries(
  userId: string,
  limit = 7
): Promise<QueryResult<JournalEntry[]>> {
  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.entryDate))
      .limit(limit);

    return { data: rows.map(rowToEntry), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function searchJournal(
  userId: string,
  query: string
): Promise<QueryResult<JournalEntry[]>> {
  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          sql`to_tsvector('english', ${journalEntries.content}) @@ plainto_tsquery('english', ${query})`
        )
      )
      .orderBy(desc(journalEntries.entryDate));

    return { data: rows.map(rowToEntry), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createOrUpdateJournalEntry(
  userId: string,
  input: CreateOrUpdateJournalInput
): Promise<QueryResult<JournalEntry>> {
  try {
    const today = getToday();
    const entryDate = input.entry_date || today;

    const [row] = await db
      .insert(journalEntries)
      .values({
        userId,
        content: input.content.trim(),
        entryDate,
        mood: input.mood ?? null,
      })
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.entryDate],
        set: {
          content: input.content.trim(),
          mood: input.mood ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { data: rowToEntry(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
