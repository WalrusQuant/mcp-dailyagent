import { getTitleModel } from "@/lib/models";
import { getConfig } from "@/lib/app-config";

type AiTask = "briefing" | "insights" | "assist" | "tools";

interface ProfileWithConfig {
  ai_model_config?: Record<string, string> | null;
}

/**
 * Returns the model ID for a given AI task.
 * Priority: user profile config > DB setting > env var > hardcoded default.
 * Fast tasks (briefing, insights, tools) use TITLE_MODEL.
 * Assist uses the default chat model.
 */
export async function getModelForTask(
  profile: ProfileWithConfig | null | undefined,
  task: AiTask
): Promise<string> {
  // Check profile config first
  if (profile?.ai_model_config?.[task]) {
    return profile.ai_model_config[task];
  }

  // Fast tasks use the title model (cheap/fast)
  if (task === "briefing" || task === "insights" || task === "tools") {
    return getTitleModel();
  }

  // Assist uses default chat model
  return (await getConfig("default_chat_model")) || "anthropic/claude-sonnet-4.5";
}
