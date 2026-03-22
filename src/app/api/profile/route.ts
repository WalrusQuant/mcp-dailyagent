import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, timezone, plan, ai_model_config, tool_calling_enabled, briefing_enabled")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    timezone: profile?.timezone ?? "UTC",
    plan: profile?.plan ?? "free",
    toolCallingEnabled: profile?.tool_calling_enabled ?? true,
    briefingEnabled: profile?.briefing_enabled ?? true,
    aiModelConfig: profile?.ai_model_config ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed: Record<string, unknown> = {};

  if (typeof body.displayName === "string" || body.displayName === null) {
    allowed.display_name = body.displayName || null;
  }

  if (typeof body.avatarUrl === "string" || body.avatarUrl === null) {
    allowed.avatar_url = body.avatarUrl || null;
  }

  if (typeof body.timezone === "string") {
    allowed.timezone = body.timezone;
  }

  if (typeof body.toolCallingEnabled === "boolean") {
    allowed.tool_calling_enabled = body.toolCallingEnabled;
  }

  if (typeof body.briefingEnabled === "boolean") {
    allowed.briefing_enabled = body.briefingEnabled;
  }

  if (body.aiModelConfig !== undefined) {
    if (body.aiModelConfig === null || typeof body.aiModelConfig === "object") {
      allowed.ai_model_config = body.aiModelConfig;
    }
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Clear profile data (keep row for auth integrity)
    await supabase
      .from("profiles")
      .update({
        display_name: null,
        avatar_url: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account data" },
      { status: 500 }
    );
  }
}
