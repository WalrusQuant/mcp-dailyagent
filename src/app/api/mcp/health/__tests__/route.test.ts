import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/mcp/health", () => {
  it("returns 200 with the expected diagnostic shape", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.transport).toBe("streamable-http");
    expect(typeof body.tools).toBe("number");
    expect(typeof body.prompts).toBe("number");
    expect(typeof body.resources).toBe("number");
    expect(typeof body.version).toBe("string");
    expect(body.tools).toBeGreaterThan(0);
  });

  it("does not leak sensitive fields", async () => {
    const response = await GET();
    const text = await response.text();
    expect(text).not.toMatch(/Bearer/i);
    expect(text).not.toMatch(/MCP_API_KEY/i);
    expect(text).not.toMatch(/Authorization/i);
  });
});
