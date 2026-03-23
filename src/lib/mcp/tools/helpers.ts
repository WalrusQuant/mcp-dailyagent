import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

export type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

interface AuthInfo {
  extra?: Record<string, unknown>;
  scopes?: string[];
}

export interface ExtractedAuth {
  userId: string;
  scopes: string[];
  plan: string;
}

/** Extract auth info from MCP extra parameter. Returns null if not authenticated. */
export function getAuth(extra: Extra): ExtractedAuth | null {
  const authInfo = (extra as unknown as { authInfo?: AuthInfo }).authInfo;
  const userId = authInfo?.extra?.userId as string | undefined;
  if (!userId) return null;
  return {
    userId,
    scopes: authInfo?.scopes ?? [],
    plan: (authInfo?.extra?.plan as string) ?? "free",
  };
}

/** Check if the required scope is present. Returns an error message or null. */
export function checkScope(scopes: string[], required: string): string | null {
  return scopes.includes(required) ? null : `Insufficient scope: ${required}`;
}

/** Build a successful text result. */
export function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Build an error result. */
export function errorResult(msg: string) {
  return {
    content: [{ type: "text" as const, text: msg }],
    isError: true as const,
  };
}

/** Standard "not authenticated" response. */
export const NOT_AUTHENTICATED = errorResult("Not authenticated");

/** Standard "paid plan required" response. */
export const PAID_PLAN_REQUIRED = errorResult(
  "This action requires a paid plan. Upgrade at https://dailyagent.dev/pricing"
);
