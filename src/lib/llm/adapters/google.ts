import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  SchemaType,
} from "@google/generative-ai";
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

interface GoogleConfig {
  apiKey: string;
  capabilities: LLMAdapterCapabilities;
}

// Map JSON Schema types to Gemini SchemaType
function mapSchemaType(type: string): SchemaType {
  const mapping: Record<string, SchemaType> = {
    string: SchemaType.STRING,
    number: SchemaType.NUMBER,
    integer: SchemaType.INTEGER,
    boolean: SchemaType.BOOLEAN,
    array: SchemaType.ARRAY,
    object: SchemaType.OBJECT,
  };
  return mapping[type] || SchemaType.STRING;
}

// Convert OpenAI-style messages to Gemini format
function convertMessages(messages: LLMMessage[]): {
  systemInstruction: string | undefined;
  contents: Content[];
} {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : msg.content.filter((c) => c.type === "text").map((c) => c.text || "").join("\n");
      systemInstruction = systemInstruction ? `${systemInstruction}\n\n${text}` : text;
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Part[] = [];
      const text = typeof msg.content === "string" ? msg.content : msg.content.filter((c) => c.type === "text").map((c) => c.text || "").join("\n");
      if (text) parts.push({ text });

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }
          parts.push({
            functionCall: { name: tc.function.name, args },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (msg.role === "tool") {
      // Tool results → functionResponse parts
      let resultData: Record<string, unknown>;
      try {
        resultData = typeof msg.content === "string" ? JSON.parse(msg.content) : { result: msg.content };
      } catch {
        resultData = { result: msg.content };
      }

      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: msg.name || msg.tool_call_id || "unknown",
              response: resultData,
            },
          },
        ],
      });
      continue;
    }

    // User messages
    const parts: Part[] = [];
    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          const url = part.image_url.url;
          if (url.startsWith("data:")) {
            const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: { mimeType: match[1], data: match[2] },
              });
            }
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role: "user", parts });
    }
  }

  return { systemInstruction, contents };
}

// Convert tool definitions to Gemini function declarations
function convertTools(tools: LLMCompletionRequest["tools"]): FunctionDeclaration[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => {
    const params = t.function.parameters as Record<string, unknown>;
    return {
      name: t.function.name,
      description: t.function.description,
      parameters: params
        ? {
            type: mapSchemaType((params.type as string) || "object"),
            properties: params.properties as Record<string, unknown> | undefined,
            required: params.required as string[] | undefined,
          }
        : undefined,
    };
  }) as FunctionDeclaration[];
}

export class GoogleAdapter implements LLMAdapter {
  private genAI: GoogleGenerativeAI;
  capabilities: LLMAdapterCapabilities;

  constructor(config: GoogleConfig) {
    this.capabilities = config.capabilities;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const { systemInstruction, contents } = convertMessages(request.messages);

    const model = this.genAI.getGenerativeModel({
      model: request.model,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(request.tools && this.capabilities.supportsTools
        ? { tools: [{ functionDeclarations: convertTools(request.tools) }] }
        : {}),
      generationConfig: {
        ...(request.max_tokens ? { maxOutputTokens: request.max_tokens } : {}),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      },
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    const candidate = response.candidates?.[0];

    let content = "";
    const toolCalls: LLMCompletionResponse["tool_calls"] = [];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Math.random().toString(36).slice(2, 11)}`,
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          });
        }
      }
    }

    const usage = response.usageMetadata;

    return {
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
      usage: usage
        ? {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
          }
        : undefined,
    };
  }

  async streamComplete(request: LLMCompletionRequest): Promise<AsyncIterable<LLMStreamChunk>> {
    const { systemInstruction, contents } = convertMessages(request.messages);

    const model = this.genAI.getGenerativeModel({
      model: request.model,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(request.tools && this.capabilities.supportsTools
        ? { tools: [{ functionDeclarations: convertTools(request.tools) }] }
        : {}),
      generationConfig: {
        ...(request.max_tokens ? { maxOutputTokens: request.max_tokens } : {}),
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      },
    });

    const result = await model.generateContentStream({ contents });

    async function* transform(): AsyncIterable<LLMStreamChunk> {
      let toolIndex = -1;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];

        if (chunk.usageMetadata) {
          totalPromptTokens = chunk.usageMetadata.promptTokenCount || 0;
          totalCompletionTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              yield { content: part.text };
            }
            if (part.functionCall) {
              toolIndex++;
              yield {
                tool_calls: [
                  {
                    index: toolIndex,
                    id: `call_${Math.random().toString(36).slice(2, 11)}`,
                    function: {
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args),
                    },
                  },
                ],
                finish_reason: "tool_calls",
              };
            }
          }
        }

        if (candidate?.finishReason) {
          const hasToolCalls = toolIndex >= 0;
          yield {
            finish_reason: hasToolCalls ? "tool_calls" : "stop",
            usage: {
              prompt_tokens: totalPromptTokens,
              completion_tokens: totalCompletionTokens,
            },
          };
        }
      }
    }

    return transform();
  }

  async generateImage(request: LLMImageRequest): Promise<LLMImageResponse> {
    // Gemini image generation via the generative model with responseModalities
    const model = this.genAI.getGenerativeModel({
      model: request.model,
      generationConfig: {
        // @ts-expect-error - responseModalities is supported but not in the type defs yet
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const result = await model.generateContent(request.prompt);
    const response = result.response;
    const candidate = response.candidates?.[0];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          return { image_url: dataUrl };
        }
      }
    }

    throw new Error("Google model did not generate an image");
  }
}
