/**
 * Token validation for MCP endpoints.
 * Self-hosted single-user: validates against MCP_API_KEY env var.
 * The token must exactly match MCP_API_KEY; userId is SELF_HOSTED_USER_ID.
 */

import { timingSafeEqual } from "node:crypto";
import { expandScopes } from "@/lib/oauth-scopes";

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface AuthResult {
  userId: string;
  authMethod: "api_key";
  scopes: string[];
  clientId?: string;
}

export interface AuthError {
  error: string;
  status: number;
  wwwAuthenticate?: string;
}

/**
 * Validate the Authorization header from an MCP request.
 * Returns the authenticated user info or an error.
 */
export async function validateMcpAuth(
  authHeader: string | null
): Promise<{ ok: true; auth: AuthResult } | { ok: false; error: AuthError }> {
  if (!authHeader) {
    return {
      ok: false,
      error: {
        error: "Missing Authorization header",
        status: 401,
        wwwAuthenticate: buildWwwAuthenticate(),
      },
    };
  }

  // Bearer token — self-hosted API key
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      error: {
        error: "Invalid Authorization header format. Expected: Bearer <token>",
        status: 401,
        wwwAuthenticate: buildWwwAuthenticate(),
      },
    };
  }

  const token = match[1];
  const expected = process.env.MCP_API_KEY;
  const userId = process.env.SELF_HOSTED_USER_ID;

  if (!expected || !userId) {
    return {
      ok: false,
      error: {
        error: "Server not configured: MCP_API_KEY or SELF_HOSTED_USER_ID unset",
        status: 500,
      },
    };
  }

  if (!tokensMatch(token, expected)) {
    return {
      ok: false,
      error: {
        error: "Invalid API key",
        status: 401,
        wwwAuthenticate: buildWwwAuthenticate("invalid_token", "API key does not match MCP_API_KEY"),
      },
    };
  }

  return {
    ok: true,
    auth: {
      userId,
      authMethod: "api_key",
      scopes: expandScopes(["all"]),
    },
  };
}

/**
 * Check if the authenticated user has the required scope.
 */
export function hasScope(auth: AuthResult, requiredScope: string): boolean {
  // If they have the expanded "all" scopes, they have everything
  // The expandScopes function already handled "all" → individual scopes
  return auth.scopes.includes(requiredScope);
}

/**
 * Build a WWW-Authenticate header value per RFC 6750.
 */
function buildWwwAuthenticate(error?: string, errorDescription?: string): string {
  const parts = [`Bearer realm="dailyagent"`];
  if (error) {
    parts.push(`error="${error}"`);
  }
  if (errorDescription) {
    parts.push(`error_description="${errorDescription}"`);
  }
  return parts.join(", ");
}
