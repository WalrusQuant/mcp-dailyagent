import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { focusSessions } from "@/lib/db/schema";
import { isOwnedRelationship } from "@/lib/db/ownership";
import { updateWithVersion } from "@/lib/db/optimistic";

export type FocusMutationError =
  | { reason: "not_found" }
  | { reason: "invalid_token" }
  | { reason: "conflict"; current: typeof focusSessions.$inferSelect }
  | { reason: "invalid_task" };

export type FocusPatch = {
  status?: "active" | "paused" | "completed" | "cancelled";
  completedAt?: Date | null;
  notes?: string | null;
  taskId?: string | null;
  durationMinutes?: number;
  breakMinutes?: number;
  startedAt?: Date;
};

export async function mutateFocusSession(
  userId: string,
  sessionId: string,
  patch: FocusPatch,
  expectedUpdatedAt?: string
): Promise<{ ok: true; row: typeof focusSessions.$inferSelect } | { ok: false; error: FocusMutationError }> {
  if (patch.taskId && !(await isOwnedRelationship(db, "task", patch.taskId, userId))) {
    return { ok: false, error: { reason: "invalid_task" } };
  }

  if (expectedUpdatedAt) {
    const result = await updateWithVersion<typeof focusSessions.$inferSelect>({
      table: focusSessions,
      id: sessionId,
      userId,
      expectedUpdatedAt,
      patch,
    });
    if (result.ok) return { ok: true, row: result.row };
    if (result.reason === "conflict") {
      return { ok: false, error: { reason: "conflict", current: result.current } };
    }
    return { ok: false, error: { reason: result.reason } };
  }

  const [row] = await db
    .update(focusSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)))
    .returning();
  return row ? { ok: true, row } : { ok: false, error: { reason: "not_found" } };
}

export async function deleteFocusSession(
  userId: string,
  sessionId: string,
  expectedUpdatedAt?: string
): Promise<{ ok: true } | { ok: false; error: FocusMutationError }> {
  if (expectedUpdatedAt) {
    const [current] = await db
      .select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)));
    if (!current) return { ok: false, error: { reason: "not_found" } };
    const token = new Date(expectedUpdatedAt);
    if (Number.isNaN(token.getTime())) return { ok: false, error: { reason: "invalid_token" } };
    if (current.updatedAt.getTime() !== token.getTime()) {
      return { ok: false, error: { reason: "conflict", current } };
    }
    const deleted = await db
      .delete(focusSessions)
      .where(and(
        eq(focusSessions.id, sessionId),
        eq(focusSessions.userId, userId),
        eq(focusSessions.updatedAt, token)
      ))
      .returning({ id: focusSessions.id });
    if (!deleted.length) {
      const [latest] = await db.select().from(focusSessions).where(and(
        eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)
      ));
      return latest
        ? { ok: false, error: { reason: "conflict", current: latest } }
        : { ok: false, error: { reason: "not_found" } };
    }
    return { ok: true };
  }

  const deleted = await db.delete(focusSessions).where(and(
    eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)
  )).returning({ id: focusSessions.id });
  return deleted.length ? { ok: true } : { ok: false, error: { reason: "not_found" } };
}
