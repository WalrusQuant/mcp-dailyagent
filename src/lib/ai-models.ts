import { createClient } from "@/lib/supabase/server";

type AiTask = "briefing" | "insights" | "assist" | "tools" | "journal_prompts" | "review";

interface ProfileWithConfig {
  ai_model_config?: Record<string, string> | null;
}

/**
 * Returns the model ID for a given AI task.
 * Priority: user profile config > default model from app_models table.
 */
export async function getModelForTask(
  profile: ProfileWithConfig | null | undefined,
  task: AiTask
): Promise<string> {
  // Check profile config first (per-user override)
  if (profile?.ai_model_config?.[task]) {
    return profile.ai_model_config[task];
  }

  // Get default model from app_models table
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_models")
    .select("model_id")
    .eq("is_default", true)
    .eq("type", "chat")
    .single();

  if (data?.model_id) {
    return data.model_id;
  }

  // Fallback: get any model from app_models
  const { data: anyModel } = await supabase
    .from("app_models")
    .select("model_id")
    .eq("type", "chat")
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();

  if (anyModel?.model_id) {
    return anyModel.model_id;
  }

  throw new Error("No AI model configured. Add a model in Admin Settings.");
}
