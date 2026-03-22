import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Model } from "@/lib/models";
import { AppModel } from "@/types/database";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";

function dbRowToModel(row: AppModel): Model {
  return {
    id: row.model_id,
    name: row.name,
    provider: row.provider,
    description: row.description,
    contextLength: row.context_length ?? undefined,
    pricing:
      row.pricing_prompt != null && row.pricing_completion != null
        ? { prompt: row.pricing_prompt, completion: row.pricing_completion }
        : undefined,
  };
}

export async function GET() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("app_models")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allModels = (rows || []) as AppModel[];
  const chatModels = allModels.filter((r) => r.type === "chat").map(dbRowToModel);
  const imageModels = allModels.filter((r) => r.type === "image").map(dbRowToModel);

  const defaultChat = allModels.find((r) => r.type === "chat" && r.is_default);
  const defaultImage = allModels.find((r) => r.type === "image" && r.is_default);

  // Check if current user is admin (for UI gating)
  let isAdmin = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin === true;
  }

  return NextResponse.json({
    chatModels,
    imageModels,
    defaultChatModel: defaultChat?.model_id || "",
    defaultImageModel: defaultImage?.model_id || "",
    isAdmin,
  });
}

// POST - add a model (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const body = await request.json();
  const { modelId, name, provider, description, type, contextLength, pricingPrompt, pricingCompletion, providerId, apiModelId } = body;

  if (!modelId || !name || !provider || !type) {
    return NextResponse.json({ error: "modelId, name, provider, and type are required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("app_models")
    .select("sort_order")
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("app_models")
    .insert({
      model_id: modelId,
      name,
      provider,
      description: description || "",
      type,
      context_length: contextLength || null,
      pricing_prompt: pricingPrompt || null,
      pricing_completion: pricingCompletion || null,
      is_default: false,
      sort_order: nextOrder,
      provider_id: providerId || null,
      api_model_id: apiModelId || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE - remove a model (admin only)
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

  const { error } = await supabase.from("app_models").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH - update a model (admin only)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const body = await request.json();
  const { id, setDefault, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (setDefault) {
    const { data: model } = await supabase
      .from("app_models")
      .select("type")
      .eq("id", id)
      .single();

    if (model) {
      await supabase
        .from("app_models")
        .update({ is_default: false })
        .eq("type", model.type);
    }

    await supabase
      .from("app_models")
      .update({ is_default: true })
      .eq("id", id);
  }

  const allowed: Record<string, unknown> = {};
  if (typeof fields.name === "string") allowed.name = fields.name;
  if (typeof fields.provider === "string") allowed.provider = fields.provider;
  if (typeof fields.description === "string") allowed.description = fields.description;
  if (typeof fields.model_id === "string") allowed.model_id = fields.model_id;
  if (fields.context_length !== undefined) allowed.context_length = fields.context_length;
  if (fields.pricing_prompt !== undefined) allowed.pricing_prompt = fields.pricing_prompt;
  if (fields.pricing_completion !== undefined) allowed.pricing_completion = fields.pricing_completion;
  if (fields.provider_id !== undefined) allowed.provider_id = fields.provider_id || null;
  if (fields.api_model_id !== undefined) allowed.api_model_id = fields.api_model_id || null;

  if (Object.keys(allowed).length > 0) {
    const { error: updateError } = await supabase
      .from("app_models")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
