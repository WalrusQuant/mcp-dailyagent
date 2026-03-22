import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMAdapter,
  LLMAdapterCapabilities,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMMessage,
  LLMImageRequest,
  LLMImageResponse,
} from "../types";

interface AnthropicConfig {
  apiKey: string;
  capabilities: LLMAdapterCapabilities;
}

// Convert OpenAI-style messages to Anthropic format
function convertMessages(messages: LLMMessage[]): {
  system: string | undefined;
  messages: Anthropic.MessageParam[];
} {
  let system: string | undefined;
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Anthropic takes system as a separate parameter
      const text = typeof msg.content === "string" ? msg.content : msg.content.filter((c) => c.type === "text").map((c) => c.text || "").join("\n");
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }

    if (msg.role === "assistant") {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls → content blocks
        const content: Anthropic.ContentBlockParam[] = [];
        if (typeof msg.content === "string" && msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(tc.function.arguments); } catch { /* empty */ }
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
        anthropicMessages.push({ role: "assistant", content });
      } else {
        const text = typeof msg.content === "string" ? msg.content : msg.content.filter((c) => c.type === "text").map((c) => c.text || "").join("\n");
        anthropicMessages.push({ role: "assistant", content: text });
      }
      continue;
    }

    if (msg.role === "tool") {
      // Tool results go as user messages with tool_result content blocks
      // Check if the last message is already a user message we can append to
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      const toolResultBlock: Anthropic.ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id || "",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      };

      if (lastMsg?.role === "user" && Array.isArray(lastMsg.content)) {
        (lastMsg.content as Anthropic.ContentBlockParam[]).push(toolResultBlock);
      } else {
        anthropicMessages.push({ role: "user", content: [toolResultBlock] });
      }
      continue;
    }

    // User messages
    if (typeof msg.content === "string") {
      anthropicMessages.push({ role: "user", content: msg.content });
    } else {
      // Multi-part content (text + images)
      const parts: Anthropic.ContentBlockParam[] = [];
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          const url = part.image_url.url;
          if (url.startsWith("data:")) {
            const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: match[2],
                },
              });
            }
          }
        }
      }
      if (parts.length > 0) {
        anthropicMessages.push({ role: "user", content: parts });
      }
    }
  }

  return { system, messages: anthropicMessages };
}

// Convert Anthropic tool definitions
function convertTools(tools: LLMCompletionRequest["tools"]): Anthropic.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
  }));
}

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  capabilities: LLMAdapterCapabilities;

  constructor(config: AnthropicConfig) {
    this.capabilities = config.capabilities;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const { system, messages } = convertMessages(request.messages);

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: request.model,
      messages,
      max_tokens: request.max_tokens || 4096,
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };

    if (request.tools && this.capabilities.supportsTools) {
      params.tools = convertTools(request.tools);
    }

    const response = await this.client.messages.create(params);

    let content = "";
    const toolCalls: LLMCompletionResponse["tool_calls"] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      finish_reason: response.stop_reason === "tool_use" ? "tool_calls" : "stop",
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
      },
    };
  }

  async streamComplete(request: LLMCompletionRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const { system, messages } = convertMessages(request.messages);

    const params: Anthropic.MessageCreateParamsStreaming = {
      model: request.model,
      messages,
      max_tokens: request.max_tokens || 4096,
      stream: true,
      ...(system ? { system } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };

    if (request.tools && this.capabilities.supportsTools) {
      params.tools = convertTools(request.tools);
    }

    const stream = this.client.messages.stream(params);

    async function* transform(): AsyncIterable<LLMStreamChunk> {
      let inputTokens = 0;
      let outputTokens = 0;
      let currentToolIndex = -1;
      let stopReason: string | null = null;

      for await (const event of stream) {
        if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }

        if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            currentToolIndex++;
            yield {
              tool_calls: [
                {
                  index: currentToolIndex,
                  id: event.content_block.id,
                  function: {
                    name: event.content_block.name,
                    arguments: "",
                  },
                },
              ],
            };
          }
        }

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { content: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            yield {
              tool_calls: [
                {
                  index: currentToolIndex,
                  function: {
                    arguments: event.delta.partial_json,
                  },
                },
              ],
            };
          }
        }

        if (event.type === "message_delta") {
          stopReason = event.delta.stop_reason;
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
        }
      }

      // Emit final chunk with usage and finish reason
      yield {
        finish_reason: stopReason === "tool_use" ? "tool_calls" : stopReason || "stop",
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
        },
      };
    }

    return transform();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateImage(_request: LLMImageRequest): Promise<LLMImageResponse> {
    throw new Error("Anthropic does not support image generation");
  }
}
