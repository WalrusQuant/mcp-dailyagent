import { z, type ZodRawShape } from "zod";
import { expect } from "vitest";

export interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

interface RegisteredTool {
  description: string;
  shape: ZodRawShape;
  handler: (args: unknown, extra: unknown) => Promise<ToolResult>;
}

export interface CallContext {
  /** Authenticated user id. Omit to simulate an unauthenticated request. */
  userId?: string;
  /** Granted scopes. Defaults to none, so scope checks fail unless provided. */
  scopes?: string[];
}

function makeExtra(ctx: CallContext) {
  return {
    authInfo: {
      extra: ctx.userId ? { userId: ctx.userId } : {},
      scopes: ctx.scopes ?? [],
    },
  };
}

/**
 * Drive a tool-registration function (e.g. `registerWorkoutTools`) without a
 * real MCP transport. Captures every `server.tool(...)` call so individual
 * handlers can be invoked directly, with the same zod validation the SDK
 * applies before dispatch.
 */
export function createToolHarness(register: (server: { tool: (...a: never[]) => void }) => void) {
  const tools = new Map<string, RegisteredTool>();

  const server = {
    tool(
      name: string,
      description: string,
      shape: ZodRawShape,
      handler: RegisteredTool["handler"]
    ) {
      tools.set(name, { description, shape, handler });
    },
  };

  register(server as unknown as { tool: (...a: never[]) => void });

  return {
    /** Names of all registered tools. */
    names: () => [...tools.keys()],

    /** True if a tool with this name was registered. */
    has: (name: string) => tools.has(name),

    /**
     * Invoke a tool the way the SDK would: validate `args` against the
     * declared schema, then call the handler with an auth-bearing `extra`.
     */
    async call(name: string, args: Record<string, unknown> = {}, ctx: CallContext = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      const parsed = z.object(tool.shape).parse(args);
      return tool.handler(parsed, makeExtra(ctx));
    },

    /** Invoke a handler bypassing schema validation (to test raw edge cases). */
    async callRaw(name: string, args: unknown, ctx: CallContext = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return tool.handler(args, makeExtra(ctx));
    },
  };
}

/** Parse the JSON text payload returned by a successful tool result. */
export function payload<T = unknown>(result: ToolResult): T {
  return JSON.parse(result.content[0].text) as T;
}

/** Assert the result is an error and return its (text) message. */
export function expectError(result: ToolResult): string {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

/** Assert the result is a success and return its parsed payload. */
export function expectOk<T = unknown>(result: ToolResult): T {
  expect(result.isError).toBeUndefined();
  return payload<T>(result);
}
