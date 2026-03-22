import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/app-config";
import type {
  LLMAdapter,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMImageResponse,
  LLMMessage,
  LLMToolDefinition,
} from "./types";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible";
import type { LLMProvider } from "@/types/database";

// Adapter cache keyed by provider ID
const adapterCache = new Map<string, LLMAdapter>();

/** Reset cached adapters (call when API keys change). */
export function resetAdapters(): void {
  adapterCache.clear();
}

interface ResolvedModel {
  apiModelId: string;
  provider: LLMProvider;
}

/**
 * Resolve a model_id to its provider and API model ID.
 * Falls back to the default OpenRouter provider if no provider_id is set.
 */
async function resolveModel(modelId: string): Promise<ResolvedModel> {
  const supabase = await createClient();

  // Look up the model in app_models
  const { data: model } = await supabase
    .from("app_models")
    .select("model_id, api_model_id, provider_id")
    .eq("model_id", modelId)
    .maybeSingle();

  const providerId = model?.provider_id || null;
  const apiModelId = model?.api_model_id || modelId;

  // If no provider_id, models are assumed to route through an openai-compatible provider
  // (typically OpenRouter). Pick the first enabled one, or use the virtual fallback.
  if (!providerId) {
    const { data: defaultProvider } = await supabase
      .from("llm_providers")
      .select("*")
      .eq("type", "openai-compatible")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultProvider) {
      return { apiModelId, provider: defaultProvider as LLMProvider };
    }

    // Ultimate fallback: no openai-compatible provider is configured in the DB,
    // so construct a virtual OpenRouter provider using the environment-level key.
    // This keeps the app functional out-of-the-box before any DB providers are set up.
    return {
      apiModelId,
      provider: {
        id: "__virtual_openrouter__",
        name: "OpenRouter",
        type: "openai-compatible",
        base_url: "https://openrouter.ai/api/v1",
        api_key_setting: "openrouter_api_key",
        is_enabled: true,
        supports_tools: true,
        supports_images: true,
        supports_streaming: true,
        extra_headers: {},
        sort_order: 0,
        created_at: "",
      },
    };
  }

  // Look up the provider (must exist and be enabled)
  const { data: provider } = await supabase
    .from("llm_providers")
    .select("*")
    .eq("id", providerId)
    .eq("is_enabled", true)
    .single();

  if (!provider) {
    throw new Error(`Provider ${providerId} not found or is disabled for model ${modelId}`);
  }

  return { apiModelId, provider: provider as LLMProvider };
}

/** Get or create a cached adapter for a provider. */
async function getAdapter(provider: LLMProvider): Promise<LLMAdapter> {
  const cached = adapterCache.get(provider.id);
  if (cached) return cached;

  // Resolve API key
  let apiKey = "";
  if (provider.api_key_setting) {
    apiKey = (await getConfig(provider.api_key_setting)) || "";
  }
  if (!apiKey) {
    throw new Error(
      `API key not configured for provider "${provider.name}". Set ${provider.api_key_setting} in Admin Settings or as an environment variable.`
    );
  }

  const capabilities = {
    supportsTools: provider.supports_tools,
    supportsImages: provider.supports_images,
    supportsStreaming: provider.supports_streaming,
  };

  let adapter: LLMAdapter;

  switch (provider.type) {
    case "openai-compatible": {
      // Build extra headers (merge provider-level + dynamic site headers for OpenRouter)
      const extraHeaders: Record<string, string> = { ...(provider.extra_headers || {}) };
      if (provider.base_url?.includes("openrouter.ai")) {
        const siteUrl = (await getConfig("site_url")) || "http://localhost:3000";
        const siteName = (await getConfig("site_name")) || "Daily Agent";
        extraHeaders["HTTP-Referer"] = extraHeaders["HTTP-Referer"] || siteUrl;
        extraHeaders["X-Title"] = extraHeaders["X-Title"] || siteName;
      }

      adapter = new OpenAICompatibleAdapter({
        apiKey,
        baseURL: provider.base_url || "https://openrouter.ai/api/v1",
        extraHeaders,
        capabilities,
      });
      break;
    }

    default:
      throw new Error(`Unknown provider type: ${provider.type}`);
  }

  adapterCache.set(provider.id, adapter);
  return adapter;
}

// ── Public API ──────────────────────────────────────────────────────────

/** Non-streaming completion. */
export async function complete(
  modelId: string,
  request: Omit<LLMCompletionRequest, "model" | "stream">
): Promise<LLMCompletionResponse> {
  const { apiModelId, provider } = await resolveModel(modelId);
  const adapter = await getAdapter(provider);

  // Strip tools if provider doesn't support them
  const tools = provider.supports_tools ? request.tools : undefined;

  return adapter.complete({
    ...request,
    model: apiModelId,
    tools,
    stream: false,
  });
}

/** Streaming completion. Returns async iterable of chunks. */
export async function streamComplete(
  modelId: string,
  request: Omit<LLMCompletionRequest, "model" | "stream">
): Promise<AsyncIterable<LLMStreamChunk>> {
  const { apiModelId, provider } = await resolveModel(modelId);
  const adapter = await getAdapter(provider);

  // Strip tools if provider doesn't support them
  const tools = provider.supports_tools ? request.tools : undefined;

  // Fall back to non-streaming if provider doesn't support it
  if (!provider.supports_streaming) {
    const response = await adapter.complete({
      ...request,
      model: apiModelId,
      tools,
      stream: false,
    });

    // Wrap non-streaming response as a single-chunk async iterable
    async function* singleChunk(): AsyncIterable<LLMStreamChunk> {
      yield {
        content: response.content,
        tool_calls: response.tool_calls?.map((tc, i) => ({
          index: i,
          id: tc.id,
          function: tc.function,
        })),
        finish_reason: response.finish_reason,
        usage: response.usage,
      };
    }

    return singleChunk();
  }

  return adapter.streamComplete({
    ...request,
    model: apiModelId,
    tools,
    stream: true,
  });
}

/** Image generation. */
export async function generateImage(
  modelId: string,
  prompt: string
): Promise<LLMImageResponse> {
  const { apiModelId, provider } = await resolveModel(modelId);
  const adapter = await getAdapter(provider);

  if (!provider.supports_images) {
    throw new Error(`Provider "${provider.name}" does not support image generation`);
  }

  if (!adapter.generateImage) {
    throw new Error(`Provider "${provider.name}" adapter does not implement image generation`);
  }

  return adapter.generateImage({ model: apiModelId, prompt });
}

// Re-export types for convenience
export type { LLMMessage, LLMToolDefinition, LLMCompletionResponse, LLMStreamChunk, LLMImageResponse };
