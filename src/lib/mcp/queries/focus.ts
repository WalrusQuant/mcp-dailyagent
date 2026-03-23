import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  duration_minutes: number;
  break_minutes: number;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "cancelled";
}

export interface TodayFocusStats {
  totalMinutes: number;
  sessionCount: number;
}

export interface StartFocusSessionInput {
  duration_minutes: number;
  task_id?: string;
  break_minutes?: number;
  notes?: string;
}

export interface GetFocusSessionsParams {
  from?: string;
  to?: string;
}

export async function getFocusSessions(
  supabase: SupabaseClient,
  userId: string,
  params?: GetFocusSessionsParams
): Promise<QueryResult<FocusSession[]>> {
  try {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const from = params?.from || defaultFrom.toISOString();
    const to = params?.to || new Date().toISOString();

    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", from)
      .lte("started_at", to)
      .order("started_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as FocusSession[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getTodayFocusStats(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<TodayFocusStats>> {
  try {
    const today = getToday();

    const { data, error } = await supabase
      .from("focus_sessions")
      .select("duration_minutes")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", `${today}T00:00:00.000Z`);

    if (error) return { data: null, error: error.message };

    const sessions = data ?? [];
    const totalMinutes = sessions.reduce((s, f) => s + (f.duration_minutes ?? 0), 0);

    return {
      data: { totalMinutes, sessionCount: sessions.length },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function startFocusSession(
  supabase: SupabaseClient,
  userId: string,
  input: StartFocusSessionInput
): Promise<QueryResult<FocusSession>> {
  try {
    const { data, error } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userId,
        task_id: input.task_id ?? null,
        duration_minutes: input.duration_minutes,
        break_minutes: typeof input.break_minutes === "number" ? input.break_minutes : 0,
        notes: input.notes ?? null,
        started_at: new Date().toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as FocusSession, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function completeFocusSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<QueryResult<FocusSession>> {
  try {
    const { data, error } = await supabase
      .from("focus_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as FocusSession, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
