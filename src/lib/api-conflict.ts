import { NextResponse } from "next/server";

/**
 * Standard 409 response for optimistic-concurrency conflicts.
 * Clients receive the current row so they can re-populate the edit form.
 */
export function conflictResponse<T>(current: T) {
  return NextResponse.json({ error: "conflict", current }, { status: 409 });
}

/**
 * True when a DB error is a Postgres unique-constraint violation (23505),
 * so routes can map it to a 409 instead of leaking a raw 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { code?: string }).code === "23505") return true;
  const message = (err as { message?: string }).message ?? "";
  return /unique|duplicate key/i.test(message);
}
