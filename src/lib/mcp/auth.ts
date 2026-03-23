import { validateMcpAuth, AuthResult } from "@/lib/token-validation";
import { getServiceClient } from "./supabase";
import { UserPlan } from "./types";

export interface McpAuthResult {
  auth: AuthResult;
  plan: UserPlan;
}

export interface McpAuthError {
  status: number;
  body: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Authenticate an MCP request. Returns auth info + user plan,
 * or an error with status code and headers.
 */
export async function authenticateMcpRequest(
  authHeader: string | null
): Promise<{ ok: true; result: McpAuthResult } | { ok: false; error: McpAuthError }> {
  const validation = await validateMcpAuth(authHeader);

  if (!validation.ok) {
    const headers: Record<string, string> = {};
    if (validation.error.wwwAuthenticate) {
      headers["WWW-Authenticate"] = validation.error.wwwAuthenticate;
    }
    return {
      ok: false,
      error: {
        status: validation.error.status,
        body: { error: validation.error.error },
        headers,
      },
    };
  }

  // Look up user plan
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", validation.auth.userId)
    .single();

  const plan: UserPlan = (profile?.plan as UserPlan) || "free";

  return {
    ok: true,
    result: {
      auth: validation.auth,
      plan,
    },
  };
}
