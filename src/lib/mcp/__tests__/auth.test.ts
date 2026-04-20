import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthResult } from "@/lib/token-validation";

// Mock token-validation before importing the module under test
vi.mock("@/lib/token-validation", () => ({
  validateMcpAuth: vi.fn(),
}));

import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { validateMcpAuth } from "@/lib/token-validation";

const mockValidateMcpAuth = vi.mocked(validateMcpAuth);

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

  it("returns auth when token is valid", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({ ok: true, auth: validAuth });

    const result = await authenticateMcpRequest("Bearer valid-token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.auth).toEqual(validAuth);
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
      expect(result.error.headers?.["WWW-Authenticate"]).toBeUndefined();
    }
  });

  it("passes the Authorization header through to validateMcpAuth", async () => {
    mockValidateMcpAuth.mockResolvedValueOnce({ ok: true, auth: validAuth });

    await authenticateMcpRequest("Bearer my-token");

    expect(mockValidateMcpAuth).toHaveBeenCalledWith("Bearer my-token");
  });
});
