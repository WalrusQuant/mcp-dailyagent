import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";

export type OptimisticResult<TRow> =
  | { ok: true; row: TRow }
  | { ok: false; reason: "conflict"; current: TRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_token" };

export function classifyUpdate<TRow>(
  updatedRows: TRow[],
  currentRows: TRow[]
): OptimisticResult<TRow> {
  if (updatedRows.length > 0) return { ok: true, row: updatedRows[0] };
  if (currentRows.length === 0) return { ok: false, reason: "not_found" };
  return { ok: false, reason: "conflict", current: currentRows[0] };
}

export function parseExpectedUpdatedAt(value: string | Date): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Predicate matching a row whose `updated_at` equals the caller's token.
 *
 * `updated_at` round-trips through JS Date (ms precision); truncate the column
 * side so legacy rows created with `defaultNow()` (µs precision) still match a
 * client-sent ms-precision token.
 *
 * The token is bound as an ISO string, not a Date: values interpolated into a
 * raw `sql` template get a no-op encoder, so postgres.js would receive the Date
 * unserialized and throw ERR_INVALID_ARG_TYPE. Column-mapped values dodge this
 * because the column's own encoder stringifies them.
 */
export function versionPredicate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  expected: Date
) {
  return sql`date_trunc('milliseconds', ${table.updatedAt}) = ${expected.toISOString()}::timestamptz`;
}

interface UpdateArgs {
  // Drizzle's per-table inferred types are incompatible across tables at the
  // generic level; callers pass a concrete table reference and get back the
  // matching row via TRow.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  id: string;
  userId: string;
  expectedUpdatedAt: string | Date;
  patch: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWithVersion<TRow = any>(
  args: UpdateArgs
): Promise<OptimisticResult<TRow>> {
  const expected = parseExpectedUpdatedAt(args.expectedUpdatedAt);
  if (!expected) return { ok: false, reason: "invalid_token" };

  const setPatch = { ...args.patch, updatedAt: new Date() };

  const updated = (await db
    .update(args.table)
    .set(setPatch)
    .where(
      and(
        eq(args.table.id, args.id),
        eq(args.table.userId, args.userId),
        versionPredicate(args.table, expected)
      )
    )
    .returning()) as TRow[];

  if (updated.length > 0) return { ok: true, row: updated[0] };

  const current = (await db
    .select()
    .from(args.table)
    .where(and(eq(args.table.id, args.id), eq(args.table.userId, args.userId)))
    .limit(1)) as TRow[];

  return classifyUpdate(updated, current);
}
