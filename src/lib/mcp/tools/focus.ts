import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getFocusSessions(userId: string, from?: string, to?: string) {
  const supabase = getServiceClient();

  let query = supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (from) query = query.gte("started_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("started_at", `${to}T23:59:59.999Z`);
  if (!from && !to) query = query.limit(30);

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
}

async function getTodayFocusStats(userId: string) {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("started_at", `${today}T00:00:00.000Z`)
    .lte("started_at", `${today}T23:59:59.999Z`);

  if (error) return { data: null, error: error.message };

  const completed = sessions?.filter((s) => s.completed_at != null) ?? [];
  const totalMinutes = completed.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  return {
    data: {
      date: today,
      totalSessions: sessions?.length ?? 0,
      completedSessions: completed.length,
      totalFocusMinutes: totalMinutes,
      sessions,
    },
    error: null,
  };
}

async function startFocusSession(
  userId: string,
  args: {
    duration_minutes: number;
    task_id?: string;
    break_minutes?: number;
  }
) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      user_id: userId,
      duration_minutes: args.duration_minutes,
      task_id: args.task_id ?? null,
      break_minutes: args.break_minutes ?? 5,
      started_at: new Date().toISOString(),
      completed_at: null,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function completeFocusSession(userId: string, sessionId: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("focus_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFocusTools(server: McpServer) {
  // --- get_focus_sessions (READ) ---
  server.tool(
    "get_focus_sessions",
    "Get focus/Pomodoro sessions, optionally filtered by date range",
    {
      from: z.string().optional().describe("Start date in YYYY-MM-DD format"),
      to: z.string().optional().describe("End date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getFocusSessions(auth.userId, args.from, args.to);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- get_focus_stats (READ) ---
  server.tool(
    "get_focus_stats",
    "Get today's focus session statistics including total minutes and session count",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getTodayFocusStats(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- start_focus_session (WRITE) ---
  server.tool(
    "start_focus_session",
    "Start a new focus/Pomodoro session",
    {
      duration_minutes: z.number().describe("Focus session duration in minutes (e.g. 25)"),
      task_id: z.string().optional().describe("Task ID to associate this session with"),
      break_minutes: z.number().optional().describe("Break duration in minutes (default: 5)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      const result = await startFocusSession(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- complete_focus_session (WRITE) ---
  server.tool(
    "complete_focus_session",
    "Mark a focus session as complete",
    {
      session_id: z.string().describe("Focus session ID to complete"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      const result = await completeFocusSession(auth.userId, args.session_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
