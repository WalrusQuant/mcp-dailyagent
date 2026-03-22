import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const FORBIDDEN = NextResponse.json(
  { error: "Admin access required" },
  { status: 403 }
);

export async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { user, isAdmin: profile?.is_admin === true };
}
