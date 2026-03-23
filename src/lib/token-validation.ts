/**
 * Token validation for MCP endpoints.
 * Supports two auth methods:
 *   1. OAuth access token (via Hydra introspection)
 *   2. API key (da_sk_ prefix, looked up in Supabase)
 *
 * Both resolve to a Supabase user_id for data access.
 */

import { introspectToken } from "@/lib/hydra";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { expandScopes } from "@/lib/oauth-scopes";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseServiceClient(url, key);
}

export interface AuthResult {
  userId: string;
  authMethod: "oauth" | "api_key";
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

  // Bearer token — could be OAuth access token or API key
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

  // API key path
  if (token.startsWith("da_sk_")) {
    return validateApiKey(token);
  }

  // OAuth token path
  return validateOAuthToken(token);
}

async function validateOAuthToken(
  token: string
): Promise<{ ok: true; auth: AuthResult } | { ok: false; error: AuthError }> {
  try {
    const result = await introspectToken(token);

    if (!result.active) {
      return {
        ok: false,
        error: {
          error: "Token is expired or revoked",
          status: 401,
          wwwAuthenticate: buildWwwAuthenticate("invalid_token", "The access token is expired or revoked"),
        },
      };
    }

    if (!result.sub) {
      return {
        ok: false,
        error: {
          error: "Token has no subject claim",
          status: 401,
          wwwAuthenticate: buildWwwAuthenticate("invalid_token", "Token missing subject"),
        },
      };
    }

    const rawScopes = result.scope ? result.scope.split(" ") : [];
    const scopes = expandScopes(rawScopes);

    return {
      ok: true,
      auth: {
        userId: result.sub,
        authMethod: "oauth",
        scopes,
        clientId: result.client_id,
      },
    };
  } catch (err) {
    console.error("OAuth token validation error:", err);
    return {
      ok: false,
      error: {
        error: "Token validation failed",
        status: 500,
      },
    };
  }
}

async function validateApiKey(
  key: string
): Promise<{ ok: true; auth: AuthResult } | { ok: false; error: AuthError }> {
  try {
    const supabase = getServiceClient();

    const keyHash = await hashApiKey(key);

    const { data, error } = await supabase
      .from("api_keys")
      .select("user_id, scopes, revoked_at, expires_at")
      .eq("key_hash", keyHash)
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: {
          error: "Invalid API key",
          status: 401,
          wwwAuthenticate: buildWwwAuthenticate("invalid_token", "API key not found"),
        },
      };
    }

    if (data.revoked_at) {
      return {
        ok: false,
        error: {
          error: "API key has been revoked",
          status: 401,
          wwwAuthenticate: buildWwwAuthenticate("invalid_token", "API key is revoked"),
        },
      };
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return {
        ok: false,
        error: {
          error: "API key has expired",
          status: 401,
          wwwAuthenticate: buildWwwAuthenticate("invalid_token", "API key is expired"),
        },
      };
    }

    // Update last_used timestamp (fire and forget)
    Promise.resolve(
      supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", keyHash)
    ).catch((err: unknown) => console.error("Failed to update last_used_at:", err));

    const scopes = Array.isArray(data.scopes) ? data.scopes as string[] : ["all"];

    return {
      ok: true,
      auth: {
        userId: data.user_id,
        authMethod: "api_key",
        scopes: expandScopes(scopes),
      },
    };
  } catch (err) {
    console.error("API key validation error:", err);
    return {
      ok: false,
      error: {
        error: "API key validation failed",
        status: 500,
      },
    };
  }
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const hydraPublicUrl = process.env.NEXT_PUBLIC_HYDRA_PUBLIC_URL;
  const parts = [`Bearer realm="dailyagent"`];
  if (hydraPublicUrl) {
    parts.push(`authorization_uri="${hydraPublicUrl}/oauth2/auth"`);
  }
  if (error) {
    parts.push(`error="${error}"`);
  }
  if (errorDescription) {
    parts.push(`error_description="${errorDescription}"`);
  }
  return parts.join(", ");
}
