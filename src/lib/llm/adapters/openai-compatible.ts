import OpenAI from "openai";
import type {
  LLMAdapter,
  LLMAdapterCapabilities,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMImageRequest,
  LLMImageResponse,
} from "../types";

interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL: string;
  extraHeaders?: Record<string, string>;
  capabilities: LLMAdapterCapabilities;
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  private client: OpenAI;
  capabilities: LLMAdapterCapabilities;
  private baseURL: string;
  private apiKey: string;
  private extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleConfig) {
    this.capabilities = config.capabilities;
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.extraHeaders = config.extraHeaders || {};
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      defaultHeaders: config.extraHeaders || {},
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: false,
    };

    if (request.tools && this.capabilities.supportsTools) {
      params.tools = request.tools as OpenAI.Chat.ChatCompletionTool[];
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];

    return {
      content: choice?.message?.content || "",
      tool_calls: choice?.message?.tool_calls
        ?.filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: "function"; function: { name: string; arguments: string } } => tc.type === "function" && "function" in tc)
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      finish_reason: choice?.finish_reason || "stop",
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async streamComplete(request: LLMCompletionRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (request.tools && this.capabilities.supportsTools) {
      params.tools = request.tools as OpenAI.Chat.ChatCompletionTool[];
    }

    const response = await this.client.chat.completions.create(params);

    async function* transform(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): AsyncIterable<LLMStreamChunk> {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        yield {
          content: choice?.delta?.content || undefined,
          tool_calls: choice?.delta?.tool_calls?.map((tc) => ({
            index: tc.index,
            id: tc.id || undefined,
            function: tc.function
              ? {
                  name: tc.function.name || undefined,
                  arguments: tc.function.arguments || undefined,
                }
              : undefined,
          })),
          finish_reason: choice?.finish_reason || undefined,
          usage: chunk.usage
            ? {
                prompt_tokens: chunk.usage.prompt_tokens,
                completion_tokens: chunk.usage.completion_tokens,
              }
            : undefined,
        };
      }
    }

    return transform(response);
  }

  async generateImage(request: LLMImageRequest): Promise<LLMImageResponse> {
    // Use raw fetch with modalities parameter (OpenRouter-style image generation)
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "user", content: request.prompt }],
        modalities: ["text", "image"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed: HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;

    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const imageData = message.images[0];
      if (imageData?.image_url?.url) {
        return { image_url: imageData.image_url.url };
      }
    }

    throw new Error("Model did not generate an image");
  }
}
