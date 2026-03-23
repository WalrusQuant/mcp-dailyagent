import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface DailyBriefing {
  id: string;
  user_id: string;
  briefing_date: string;
  content: string;
  created_at: string;
}

/** Get today's cached daily briefing, if it exists */
export async function getTodayBriefing(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<DailyBriefing | null>> {
  try {
    const today = getToday();

    const { data, error } = await supabase
      .from("daily_briefings")
      .select("*")
      .eq("user_id", userId)
      .eq("briefing_date", today)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as DailyBriefing | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Generate a new daily briefing via MCP.
 * Briefing generation requires AI model resolution which is not available in the MCP query layer.
 * Use the /api/briefing endpoint directly for generation.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateBriefing(supabase: SupabaseClient, userId: string): Promise<QueryResult<never>> {
  return { data: null, error: "Briefing generation via MCP coming soon" };
}
