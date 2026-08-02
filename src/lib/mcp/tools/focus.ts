import { resolveDateContext, zonedDateRange, zonedDayRange, zonedDateTimeToInstant } from "@/lib/date-context";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, conflictResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, uuidSchema } from "./validators";
import { isOwned } from "@/lib/db/ownership";
import { isOrderedDateRange } from "@/lib/validation";
import { deleteFocusSession, mutateFocusSession, FocusPatch } from "@/lib/focus/mutations";
import { serializeSession } from "@/lib/mcp/queries/focus";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getFocusSessions(userId: string, from?: string, to?: string) {
  try {
    const context = await resolveDateContext(userId);
    const start = from ? zonedDateTimeToInstant(from, context.timezone) : null;
    const exclusiveEnd = to ? zonedDateRange(to, to, context.timezone).end : null;
    const conditions =
      from && to
        ? and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, start!),
            lt(focusSessions.startedAt, exclusiveEnd!)
          )
        : from
        ? and(
            eq(focusSessions.userId, userId),
            gte(focusSessions.startedAt, start!)
          )
        : to
        ? and(
            eq(focusSessions.userId, userId),
            lt(focusSessions.startedAt, exclusiveEnd!)
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
  const context = await resolveDateContext(userId);
  const today = context.today;
  const range = zonedDayRange(today, context.timezone);

  try {
    const sessions = await db
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startedAt, range.start),
          lt(focusSessions.startedAt, range.end)
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
        breakMinutes: args.break_minutes ?? 0,
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

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFocusTools(server: McpServer) {
  async function applyMutation(userId: string, sessionId: string, patch: FocusPatch, token?: string) {
    const result = await mutateFocusSession(userId, sessionId, patch, token);
    if (result.ok) return textResult(serializeSession(result.row));
    if (result.error.reason === "not_found") return errorResult("Session not found");
    if (result.error.reason === "invalid_token") return errorResult("Invalid expected_updated_at");
    if (result.error.reason === "invalid_task") return errorResult("task_id must reference one of your tasks");
    return conflictResult(serializeSession(result.error.current));
  }
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

      if (!isOrderedDateRange(args.from, args.to)) return errorResult("to must be on or after from");

      const result = await getFocusSessions(auth.userId, args.from, args.to);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data?.map(serializeSession));
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

      return textResult(result.data ? {
        ...result.data,
        sessions: result.data.sessions.map(serializeSession),
      } : result.data);
    }
  );

  // --- start_focus_session (WRITE) ---
  server.tool(
    "start_focus_session",
    "Start a new focus/Pomodoro session",
    {
      duration_minutes: z.number().int().min(1).max(480).describe("Focus session duration in minutes (1-480, e.g. 25)"),
      task_id: uuidSchema.optional().describe("Task ID to associate this session with (from list_tasks)"),
      break_minutes: z.number().int().min(0).max(120).optional().describe("Break duration in minutes (0-120, default: 5)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      if (args.task_id && !(await isOwned("task", args.task_id, auth.userId))) {
        return errorResult("Error: task_id must reference one of your tasks");
      }

      const result = await startFocusSession(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data ? serializeSession(result.data) : result.data);
    }
  );

  // --- complete_focus_session (WRITE) ---
  server.tool(
    "complete_focus_session",
    "Mark a focus session as complete. Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      session_id: uuidSchema.describe("Focus session ID to complete (from get_focus_sessions)"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency."),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      return applyMutation(auth.userId, args.session_id, {
        status: "completed", completedAt: new Date(),
      }, args.expected_updated_at);
    }
  );

  // --- pause_focus_session (WRITE) ---
  server.tool(
    "pause_focus_session",
    "Pause an in-progress focus session (sets status to 'paused'). Resume it later with resume_focus_session. Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      session_id: uuidSchema.describe("Focus session ID to pause (from get_focus_sessions)"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency."),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      return applyMutation(auth.userId, args.session_id, { status: "paused" }, args.expected_updated_at);
    }
  );

  // --- resume_focus_session (WRITE) ---
  server.tool(
    "resume_focus_session",
    "Resume a paused focus session (sets status back to 'active'). Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      session_id: uuidSchema.describe("Focus session ID to resume (from get_focus_sessions)"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency."),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);

      return applyMutation(auth.userId, args.session_id, { status: "active" }, args.expected_updated_at);
    }
  );

  server.tool(
    "update_focus_session",
    "Correct a focus session's task, timing, duration, break, notes, or status. Only supplied fields change.",
    {
      session_id: uuidSchema.describe("Focus session ID from get_focus_sessions"),
      task_id: uuidSchema.nullable().optional().describe("Owned task ID, or null to unlink"),
      duration_minutes: z.number().int().min(1).max(480).optional(),
      break_minutes: z.number().int().min(0).max(120).optional(),
      started_at: z.string().datetime().optional(),
      completed_at: z.string().datetime().nullable().optional(),
      status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
      notes: z.string().nullable().optional(),
      expected_updated_at: z.string().datetime().optional(),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);
      const patch: FocusPatch = {};
      if (args.task_id !== undefined) patch.taskId = args.task_id;
      if (args.duration_minutes !== undefined) patch.durationMinutes = args.duration_minutes;
      if (args.break_minutes !== undefined) patch.breakMinutes = args.break_minutes;
      if (args.started_at !== undefined) patch.startedAt = new Date(args.started_at);
      if (args.completed_at !== undefined) patch.completedAt = args.completed_at ? new Date(args.completed_at) : null;
      if (args.status !== undefined) patch.status = args.status;
      if (args.notes !== undefined) patch.notes = args.notes;
      if (!Object.keys(patch).length) return errorResult("No valid fields to update");
      if (patch.status === "completed" && args.completed_at === undefined) patch.completedAt = new Date();
      if (patch.status === "active" && args.completed_at === undefined) patch.completedAt = null;
      return applyMutation(auth.userId, args.session_id, patch, args.expected_updated_at);
    }
  );

  server.tool(
    "cancel_focus_session",
    "Cancel a focus session while preserving it in history.",
    {
      session_id: uuidSchema.describe("Focus session ID from get_focus_sessions"),
      expected_updated_at: z.string().datetime().optional(),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);
      return applyMutation(auth.userId, args.session_id, { status: "cancelled", completedAt: null }, args.expected_updated_at);
    }
  );

  server.tool(
    "delete_focus_session",
    "Permanently delete a focus session.",
    {
      session_id: uuidSchema.describe("Focus session ID from get_focus_sessions"),
      expected_updated_at: z.string().datetime().optional(),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "focus:write");
      if (scopeError) return errorResult(scopeError);
      const result = await deleteFocusSession(auth.userId, args.session_id, args.expected_updated_at);
      if (result.ok) return textResult({ success: true });
      if (result.error.reason === "not_found") return errorResult("Session not found");
      if (result.error.reason === "invalid_token") return errorResult("Invalid expected_updated_at");
      if (result.error.reason === "conflict") return conflictResult(serializeSession(result.error.current));
      return errorResult("Unable to delete session");
    }
  );
}
