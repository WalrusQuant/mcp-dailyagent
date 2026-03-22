import { getConfig } from "@/lib/app-config";

type AiTask = "briefing" | "insights" | "assist" | "tools";

interface ProfileWithConfig {
  ai_model_config?: Record<string, string> | null;
}

const DEFAULT_FAST_MODEL = process.env.TITLE_MODEL || "google/gemini-flash-2.0";
const DEFAULT_CHAT_MODEL = process.env.DEFAULT_CHAT_MODEL || "anthropic/claude-sonnet-4.5";

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
    return (await getConfig("title_model")) || DEFAULT_FAST_MODEL;
  }

  // Assist uses default chat model
  return (await getConfig("default_chat_model")) || DEFAULT_CHAT_MODEL;
}
