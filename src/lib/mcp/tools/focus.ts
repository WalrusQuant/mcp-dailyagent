import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getFocusSessions(userId: string, from?: string, to?: string) {
  try {
    const conditions =
      from && to
        ? and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, new Date(`${from}T00:00:00.000Z`)),
            lte(focusSessions.startedAt, new Date(`${to}T23:59:59.999Z`))
          )
        : from
        ? and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, new Date(`${from}T00:00:00.000Z`))
          )
        : to
        ? and(
            eq(focusSessions.userId, userId),
            lte(focusSessions.startedAt, new Date(`${to}T23:59:59.999Z`))
          )
        : eq(focusSessions.userId, userId);

    const query = db
      .select()
      .from(focusSessions)
      .where(conditions)
      .orderBy(desc(focusSessions.startedAt));

    const rows = !from && !to ? await query.limit(30) : await query;

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function getTodayFocusStats(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  try {
    const sessions = await db
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startedAt, new Date(`${today}T00:00:00.000Z`)),
          lte(focusSessions.startedAt, new Date(`${today}T23:59:59.999Z`))
        )
      );

    const completed = sessions.filter((s) => s.completedAt != null);
    const totalMinutes = completed.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

    return {
      data: {
        date: today,
        totalSessions: sessions.length,
        completedSessions: completed.length,
        totalFocusMinutes: totalMinutes,
        sessions,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function startFocusSession(
  userId: string,
  args: {
    duration_minutes: number;
    task_id?: string;
    break_minutes?: number;
  }
) {
  try {
    const [row] = await db
      .insert(focusSessions)
      .values({
        userId,
        durationMinutes: args.duration_minutes,
        taskId: args.task_id ?? null,
        breakMinutes: args.break_minutes ?? 5,
        startedAt: new Date(),
        completedAt: null,
        status: "active",
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function completeFocusSession(userId: string, sessionId: string) {
  try {
    const [row] = await db
      .update(focusSessions)
      .set({ completedAt: new Date(), status: "completed" })
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Session not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
      from: dateSchema.optional().describe("Start date in YYYY-MM-DD format"),
      to: dateSchema.optional().describe("End date in YYYY-MM-DD format"),
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
      duration_minutes: z.number().int().min(1).max(480).describe("Focus session duration in minutes (1-480, e.g. 25)"),
      task_id: z.string().optional().describe("Task ID to associate this session with"),
      break_minutes: z.number().int().min(0).max(120).optional().describe("Break duration in minutes (0-120, default: 5)"),
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
