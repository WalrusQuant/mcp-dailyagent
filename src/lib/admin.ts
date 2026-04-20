import { NextResponse } from "next/server";

export const FORBIDDEN = NextResponse.json(
  { error: "Admin access required" },
  { status: 403 }
);

/**
 * Single-user self-hosted app — the one user is always admin.
 */
export async function isAdmin(): Promise<boolean> {
  return true;
}

/**
 * Returns { isAdmin: true } always.
 * Accepts an optional argument for call-site compatibility with routes that
 * pass a Supabase client (those routes are being migrated separately).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAdmin(_supabase?: any): Promise<{ isAdmin: boolean }> {
  return { isAdmin: true };
}
