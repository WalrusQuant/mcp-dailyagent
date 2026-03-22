import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";

// GET — list all usage limits with user email
export async function GET() {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { data, error } = await supabase
    .from("usage_limits")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch user emails for limits with user_id
  const userIds = (data || []).filter((l) => l.user_id).map((l) => l.user_id as string);
  let userMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    userMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.email]));
  }

  const enriched = (data || []).map((l) => ({
    ...l,
    user_email: l.user_id ? userMap[l.user_id] || null : null,
  }));

  return NextResponse.json(enriched);
}

// POST — create a usage limit
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const body = await request.json();
  const { user_id, limit_type, limit_value, period, mode } = body;

  if (!limit_type || !["cost", "tokens"].includes(limit_type)) {
    return NextResponse.json({ error: "limit_type must be 'cost' or 'tokens'" }, { status: 400 });
  }
  if (!period || !["daily", "monthly"].includes(period)) {
    return NextResponse.json({ error: "period must be 'daily' or 'monthly'" }, { status: 400 });
  }
  if (mode && !["hard", "soft"].includes(mode)) {
    return NextResponse.json({ error: "mode must be 'hard' or 'soft'" }, { status: 400 });
  }
  if (!limit_value || Number(limit_value) <= 0) {
    return NextResponse.json({ error: "limit_value must be greater than 0" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("usage_limits")
    .insert({
      user_id: user_id || null,
      limit_type,
      limit_value: Number(limit_value),
      period,
      mode: mode || "hard",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A limit with this type and period already exists for this scope" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH — update a usage limit
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (fields.limit_value !== undefined) {
    if (Number(fields.limit_value) <= 0) {
      return NextResponse.json({ error: "limit_value must be greater than 0" }, { status: 400 });
    }
    allowed.limit_value = Number(fields.limit_value);
  }
  if (fields.mode !== undefined) {
    if (!["hard", "soft"].includes(fields.mode)) {
      return NextResponse.json({ error: "mode must be 'hard' or 'soft'" }, { status: 400 });
    }
    allowed.mode = fields.mode;
  }
  if (typeof fields.active === "boolean") {
    allowed.active = fields.active;
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowed.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("usage_limits")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Usage limit not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE — remove a usage limit
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("usage_limits").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
