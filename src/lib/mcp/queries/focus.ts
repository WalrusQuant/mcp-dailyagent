import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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

function rowToSession(row: typeof focusSessions.$inferSelect): FocusSession {
  return {
    id: row.id,
    user_id: row.userId,
    task_id: row.taskId ?? null,
    duration_minutes: row.durationMinutes,
    break_minutes: row.breakMinutes,
    notes: row.notes ?? null,
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    status: row.status as "active" | "completed" | "cancelled",
  };
}

export async function getFocusSessions(
  userId: string,
  params?: GetFocusSessionsParams
): Promise<QueryResult<FocusSession[]>> {
  try {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const from = params?.from || defaultFrom.toISOString();
    const to = params?.to || new Date().toISOString();

    const rows = await db
      .select()
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          gte(focusSessions.startedAt, new Date(from)),
          lte(focusSessions.startedAt, new Date(to))
        )
      )
      .orderBy(desc(focusSessions.startedAt));

    return { data: rows.map(rowToSession), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getTodayFocusStats(
  userId: string
): Promise<QueryResult<TodayFocusStats>> {
  try {
    const today = getToday();

    const rows = await db
      .select({ durationMinutes: focusSessions.durationMinutes })
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, userId),
          eq(focusSessions.status, "completed"),
          gte(focusSessions.startedAt, new Date(`${today}T00:00:00.000Z`))
        )
      );

    const totalMinutes = rows.reduce((s, f) => s + (f.durationMinutes ?? 0), 0);

    return {
      data: { totalMinutes, sessionCount: rows.length },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function startFocusSession(
  userId: string,
  input: StartFocusSessionInput
): Promise<QueryResult<FocusSession>> {
  try {
    const [row] = await db
      .insert(focusSessions)
      .values({
        userId,
        taskId: input.task_id ?? null,
        durationMinutes: input.duration_minutes,
        breakMinutes: typeof input.break_minutes === "number" ? input.break_minutes : 0,
        notes: input.notes ?? null,
        startedAt: new Date(),
        status: "active",
      })
      .returning();

    return { data: rowToSession(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function completeFocusSession(
  userId: string,
  sessionId: string
): Promise<QueryResult<FocusSession>> {
  try {
    const [row] = await db
      .update(focusSessions)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Session not found" };
    return { data: rowToSession(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
