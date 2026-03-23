import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthResult } from "@/lib/token-validation";
import { UserPlan } from "@/lib/mcp/types";

// Mock token-validation before importing the module under test
vi.mock("@/lib/token-validation", () => ({
  validateMcpAuth: vi.fn(),
}));

// Mock the MCP supabase service client
vi.mock("@/lib/mcp/supabase", () => ({
  getServiceClient: vi.fn(),
}));

import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { validateMcpAuth } from "@/lib/token-validation";
import { getServiceClient } from "@/lib/mcp/supabase";

const mockValidateMcpAuth = vi.mocked(validateMcpAuth);
const mockGetServiceClient = vi.mocked(getServiceClient);

/** Build a minimal mock SupabaseClient that returns the given profile row. */
function makeMockSupabase(profile: { plan: string } | null) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as ReturnType<typeof getServiceClient>;
}

const validAuth: AuthResult = {
  userId: "user-123",
  authMethod: "api_key",
  scopes: ["tasks:read", "tasks:write"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authenticateMcpRequest", () => {
  it("returns 401 error when Authorization header is null", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({
      ok: false,
      error: {
        error: "Missing Authorization header",
        status: 401,
        wwwAuthenticate: 'Bearer realm="dailyagent"',
      },
    });

    const result = await authenticateMcpRequest(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(401);
      expect(result.error.body.error).toContain("Missing");
      expect(result.error.headers?.["WWW-Authenticate"]).toBeTruthy();
    }
  });

  it("forwards the error from validateMcpAuth when token is invalid", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({
      ok: false,
      error: {
        error: "Token is expired or revoked",
        status: 401,
        wwwAuthenticate: 'Bearer realm="dailyagent", error="invalid_token"',
      },
    });

    const result = await authenticateMcpRequest("Bearer expired-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(401);
      expect(result.error.body.error).toBe("Token is expired or revoked");
      expect(result.error.headers?.["WWW-Authenticate"]).toContain("invalid_token");
    }
  });

  it("returns auth + plan when token is valid and profile exists", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({ ok: true, auth: validAuth });
    mockGetServiceClient.mockReturnValue(makeMockSupabase({ plan: "active" }));

    const result = await authenticateMcpRequest("Bearer valid-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.auth).toEqual(validAuth);
      expect(result.result.plan).toBe("active" satisfies UserPlan);
    }
  });

  it('defaults to "free" plan when profile is not found', async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({ ok: true, auth: validAuth });
    mockGetServiceClient.mockReturnValue(makeMockSupabase(null));

    const result = await authenticateMcpRequest("Bearer valid-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.plan).toBe("free" satisfies UserPlan);
    }
  });

  it("does not include WWW-Authenticate header when error has no wwwAuthenticate field", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({
      ok: false,
      error: {
        error: "Token validation failed",
        status: 500,
      },
    });

    const result = await authenticateMcpRequest("Bearer broken-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
      // headers should be empty object when no wwwAuthenticate present
      expect(result.error.headers?.["WWW-Authenticate"]).toBeUndefined();
    }
  });

  it("passes the Authorization header through to validateMcpAuth", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({ ok: true, auth: validAuth });
    mockGetServiceClient.mockReturnValue(makeMockSupabase({ plan: "free" }));

    await authenticateMcpRequest("Bearer my-token");

    expect(mockValidateMcpAuth).toHaveBeenCalledWith("Bearer my-token");
  });
});
