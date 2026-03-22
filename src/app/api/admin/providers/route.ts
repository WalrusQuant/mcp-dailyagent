import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";
import { resetAdapters } from "@/lib/llm";

// GET — list all providers
export async function GET() {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { data, error } = await supabase
    .from("llm_providers")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST — create a provider
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const body = await request.json();
  const { name, type, base_url, api_key_setting, supports_tools, supports_images, supports_streaming, extra_headers } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  if (!["openai-compatible", "anthropic", "google"].includes(type)) {
    return NextResponse.json({ error: "type must be openai-compatible, anthropic, or google" }, { status: 400 });
  }

  // Get next sort order
  const { data: existing } = await supabase
    .from("llm_providers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("llm_providers")
    .insert({
      name,
      type,
      base_url: base_url || null,
      api_key_setting: api_key_setting || null,
      supports_tools: supports_tools ?? true,
      supports_images: supports_images ?? false,
      supports_streaming: supports_streaming ?? true,
      extra_headers: extra_headers || {},
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  resetAdapters();
  return NextResponse.json(data);
}

// PATCH — update a provider
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
  if (typeof fields.name === "string") allowed.name = fields.name;
  if (typeof fields.type === "string") {
    if (!["openai-compatible", "anthropic", "google"].includes(fields.type)) {
      return NextResponse.json({ error: "Invalid provider type" }, { status: 400 });
    }
    allowed.type = fields.type;
  }
  if (fields.base_url !== undefined) allowed.base_url = fields.base_url;
  if (fields.api_key_setting !== undefined) allowed.api_key_setting = fields.api_key_setting;
  if (typeof fields.is_enabled === "boolean") allowed.is_enabled = fields.is_enabled;
  if (typeof fields.supports_tools === "boolean") allowed.supports_tools = fields.supports_tools;
  if (typeof fields.supports_images === "boolean") allowed.supports_images = fields.supports_images;
  if (typeof fields.supports_streaming === "boolean") allowed.supports_streaming = fields.supports_streaming;
  if (fields.extra_headers !== undefined) allowed.extra_headers = fields.extra_headers;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("llm_providers").update(allowed).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  resetAdapters();
  return NextResponse.json({ success: true });
}

// DELETE — remove a provider
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

  const { error } = await supabase.from("llm_providers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  resetAdapters();
  return NextResponse.json({ success: true });
}
