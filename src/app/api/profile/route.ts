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
    .select("system_prompt, search_model, search_results_basic, search_results_advanced, context_injection, tool_calling_enabled, briefing_enabled, ai_model_config, monthly_budget, memory_notes")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    systemPrompt: profile?.system_prompt || "",
    searchModel: profile?.search_model || null,
    searchResultsBasic: profile?.search_results_basic ?? 10,
    searchResultsAdvanced: profile?.search_results_advanced ?? 20,
    contextInjection: profile?.context_injection ?? true,
    toolCallingEnabled: profile?.tool_calling_enabled ?? true,
    briefingEnabled: profile?.briefing_enabled ?? true,
    aiModelConfig: profile?.ai_model_config ?? null,
    monthlyBudget: profile?.monthly_budget ?? null,
    memoryNotes: profile?.memory_notes ?? null,
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

  if (typeof body.systemPrompt === "string") {
    allowed.system_prompt = body.systemPrompt || null;
  }

  if (body.searchModel !== undefined) {
    allowed.search_model = typeof body.searchModel === "string" ? body.searchModel : null;
  }

  if (body.searchResultsBasic !== undefined) {
    const val = Number(body.searchResultsBasic);
    if (!Number.isInteger(val) || val < 1 || val > 50) {
      return NextResponse.json({ error: "searchResultsBasic must be an integer 1-50" }, { status: 400 });
    }
    allowed.search_results_basic = val;
  }

  if (body.searchResultsAdvanced !== undefined) {
    const val = Number(body.searchResultsAdvanced);
    if (!Number.isInteger(val) || val < 1 || val > 50) {
      return NextResponse.json({ error: "searchResultsAdvanced must be an integer 1-50" }, { status: 400 });
    }
    allowed.search_results_advanced = val;
  }

  if (typeof body.contextInjection === "boolean") {
    allowed.context_injection = body.contextInjection;
  }

  if (typeof body.toolCallingEnabled === "boolean") {
    allowed.tool_calling_enabled = body.toolCallingEnabled;
  }

  if (typeof body.briefingEnabled === "boolean") {
    allowed.briefing_enabled = body.briefingEnabled;
  }

  if (body.monthlyBudget !== undefined) {
    if (body.monthlyBudget === null) {
      allowed.monthly_budget = null;
    } else {
      const val = Number(body.monthlyBudget);
      if (isNaN(val) || val < 0) {
        return NextResponse.json({ error: "monthlyBudget must be a positive number" }, { status: 400 });
      }
      allowed.monthly_budget = val;
    }
  }

  if (typeof body.memoryNotes === "string") {
    allowed.memory_notes = body.memoryNotes || null;
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
    // Get all conversation IDs for this user
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    // Delete messages (linked to conversations)
    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id);
      await supabase.from("messages").delete().in("conversation_id", convIds);
    }

    // Delete conversations
    await supabase.from("conversations").delete().eq("user_id", user.id);

    // Delete generated images
    await supabase.from("generated_images").delete().eq("user_id", user.id);

    // Clear profile data (keep row for auth integrity)
    await supabase
      .from("profiles")
      .update({
        system_prompt: null,
        search_model: null,
        display_name: null,
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
