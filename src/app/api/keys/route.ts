import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateApiKey } from "@/lib/api-keys";

// GET /api/keys — List user's API keys (never returns full key)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(keys);
}

// POST /api/keys — Generate a new API key (returns full key ONCE)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Check plan-based key limits
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "free") {
    const { count } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        { error: "Free plan is limited to 1 API key. Upgrade to create more." },
        { status: 403 }
      );
    }
  }

  const { fullKey, prefix, hash } = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    name,
    key_prefix: prefix,
    key_hash: hash,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return the full key — this is the only time it's visible
  return NextResponse.json({ key: fullKey, prefix, name }, { status: 201 });
}
