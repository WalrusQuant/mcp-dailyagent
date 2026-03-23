import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

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

export async function getJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<QueryResult<JournalEntry | null>> {
  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("entry_date", date)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as JournalEntry | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getRecentJournalEntries(
  supabase: SupabaseClient,
  userId: string,
  limit = 7
): Promise<QueryResult<JournalEntry[]>> {
  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: data as JournalEntry[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function searchJournal(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<QueryResult<JournalEntry[]>> {
  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .textSearch("content", query, { type: "websearch" })
      .order("entry_date", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as JournalEntry[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createOrUpdateJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  input: CreateOrUpdateJournalInput
): Promise<QueryResult<JournalEntry>> {
  try {
    const today = getToday();
    const entryDate = input.entry_date || today;

    const { data, error } = await supabase
      .from("journal_entries")
      .upsert(
        {
          user_id: userId,
          content: input.content.trim(),
          entry_date: entryDate,
          mood: input.mood ?? null,
        },
        { onConflict: "user_id,entry_date" }
      )
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as JournalEntry, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
