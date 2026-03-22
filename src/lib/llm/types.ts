/** Shared types for the multi-provider LLM abstraction layer. */

// OpenAI-style message format used internally
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string; // for tool role: the function name
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompletionRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: LLMToolDefinition[];
  stream?: boolean;
}

export interface LLMCompletionResponse {
  content: string;
  tool_calls?: LLMToolCall[];
  finish_reason: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface LLMStreamChunk {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface LLMImageRequest {
  model: string;
  prompt: string;
}

export interface LLMImageResponse {
  image_url: string;
}

export interface LLMAdapterCapabilities {
  supportsTools: boolean;
  supportsImages: boolean;
  supportsStreaming: boolean;
}

export interface LLMAdapter {
  capabilities: LLMAdapterCapabilities;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  streamComplete(request: LLMCompletionRequest): Promise<AsyncIterable<LLMStreamChunk>>;
  generateImage?(request: LLMImageRequest): Promise<LLMImageResponse>;
}
