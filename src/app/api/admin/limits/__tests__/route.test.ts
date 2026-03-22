import { GET, POST, PATCH, DELETE } from "@/app/api/admin/limits/route";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  FORBIDDEN: new Response(JSON.stringify({ error: "Admin access required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  }),
  requireAdmin: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options as never);
}

function mockAdmin(isAdmin: boolean, userId = "u1") {
  const client = createMockSupabaseClient({
    user: isAdmin ? { id: userId } : { id: userId },
    tables: {
      usage_limits: { data: [], error: null },
      profiles: { data: [], error: null },
    },
  });
  vi.mocked(createClient).mockResolvedValue(client as never);
  vi.mocked(requireAdmin).mockResolvedValue({
    user: { id: userId } as never,
    isAdmin,
  });
  return client;
}

function mockUnauth() {
  const client = createMockSupabaseClient({ user: null });
  vi.mocked(createClient).mockResolvedValue(client as never);
  vi.mocked(requireAdmin).mockResolvedValue({ user: null, isAdmin: false });
  return client;
}

describe("GET /api/admin/limits", () => {
  it("returns 401 for unauthenticated user", async () => {
    mockUnauth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAdmin(false);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns limits for admin", async () => {
    mockAdmin(true);
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/limits", () => {
  it("returns 401 for unauthenticated", async () => {
    mockUnauth();
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAdmin(false);
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(403);
  });

  it("validates limit_type", async () => {
    mockAdmin(true);
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({ limit_type: "invalid", period: "daily", limit_value: 10 }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("limit_type");
  });

  it("validates period", async () => {
    mockAdmin(true);
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({ limit_type: "cost", period: "invalid", limit_value: 10 }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("period");
  });

  it("validates mode", async () => {
    mockAdmin(true);
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({ limit_type: "cost", period: "daily", mode: "invalid", limit_value: 10 }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("mode");
  });

  it("validates limit_value > 0", async () => {
    mockAdmin(true);
    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({ limit_type: "cost", period: "daily", limit_value: 0 }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("limit_value");
  });

  it("creates limit with valid input", async () => {
    const client = mockAdmin(true);
    // Override to return created data
    const mockData = { id: "l1", limit_type: "cost", period: "daily", limit_value: 50 };
    client.from.mockImplementation(() => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
      // Make thenable
      Object.defineProperty(builder, "then", {
        value: (resolve: (v: unknown) => void) => resolve({ data: mockData, error: null }),
      });
      return builder;
    });

    const res = await POST(
      makeRequest("/api/admin/limits", {
        method: "POST",
        body: JSON.stringify({ limit_type: "cost", period: "daily", limit_value: 50 }),
      })
    );
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/limits", () => {
  it("returns 400 when id missing", async () => {
    mockAdmin(true);
    const res = await PATCH(
      makeRequest("/api/admin/limits", {
        method: "PATCH",
        body: JSON.stringify({ limit_value: 100 }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("returns 400 when no valid fields", async () => {
    mockAdmin(true);
    const res = await PATCH(
      makeRequest("/api/admin/limits", {
        method: "PATCH",
        body: JSON.stringify({ id: "l1", bogus: "field" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No valid fields to update");
  });

  it("validates limit_value > 0", async () => {
    mockAdmin(true);
    const res = await PATCH(
      makeRequest("/api/admin/limits", {
        method: "PATCH",
        body: JSON.stringify({ id: "l1", limit_value: -5 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("validates mode value", async () => {
    mockAdmin(true);
    const res = await PATCH(
      makeRequest("/api/admin/limits", {
        method: "PATCH",
        body: JSON.stringify({ id: "l1", mode: "invalid" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/limits", () => {
  it("returns 400 when id missing", async () => {
    mockAdmin(true);
    const res = await DELETE(makeRequest("/api/admin/limits"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id is required");
  });

  it("deletes with valid id", async () => {
    mockAdmin(true);
    const res = await DELETE(makeRequest("/api/admin/limits?id=l1"));
    expect(res.status).toBe(200);
  });
});
