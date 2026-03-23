import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";


export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Get the most recent weekly review */
export async function getLatestReview(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<WeeklyReview | null>> {
  try {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as WeeklyReview | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Get the weekly review for a specific week */
export async function getReviewForWeek(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string
): Promise<QueryResult<WeeklyReview | null>> {
  try {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as WeeklyReview | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface SaveReviewInput {
  week_start: string;
  content: string;
}

/** Upsert a weekly review, tagged as source='mcp' */
export async function saveReview(
  supabase: SupabaseClient,
  userId: string,
  input: SaveReviewInput
): Promise<QueryResult<WeeklyReview>> {
  try {
    const { data, error } = await supabase
      .from("weekly_reviews")
      .upsert(
        {
          user_id: userId,
          week_start: input.week_start,
          content: input.content,
          source: "mcp",
        },
        { onConflict: "user_id,week_start" }
      )
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as WeeklyReview, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
