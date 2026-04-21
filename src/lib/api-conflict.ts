import { NextResponse } from "next/server";

/**
 * Standard 409 response for optimistic-concurrency conflicts.
 * Clients receive the current row so they can re-populate the edit form.
 */
export function conflictResponse<T>(current: T) {
  return NextResponse.json({ error: "conflict", current }, { status: 409 });
}
