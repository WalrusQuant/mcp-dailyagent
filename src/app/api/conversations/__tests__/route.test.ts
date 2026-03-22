import { GET, POST } from "@/app/api/conversations/route";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("GET /api/conversations", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createMockSupabaseClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/conversations"));
    expect(res.status).toBe(401);
  });

  it("returns paginated conversations", async () => {
    const convos = [
      { id: "c1", title: "Chat 1" },
      { id: "c2", title: "Chat 2" },
    ];
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { conversations: { data: convos, error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/conversations"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(convos);
  });

  it("passes project_id filter", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { conversations: { data: [], error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/conversations?project_id=p1"));
    expect(res.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith("conversations");
  });

  it("returns empty array when tag filter matches nothing", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: {
        conversations: { data: [], error: null },
        conversation_tags: { data: [], error: null },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/conversations?tag=t1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { conversations: { data: null, error: { message: "DB fail" } } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/conversations"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/conversations", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createMockSupabaseClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("creates conversation with defaults", async () => {
    const convo = { id: "c1", title: "New Chat", model: "anthropic/claude-sonnet-4.5" };
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { conversations: { data: convo, error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(convo);
  });

  it("validates project ownership (404 on bad project_id)", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: {
        projects: { data: null, error: { code: "PGRST116", message: "not found" } },
        conversations: { data: null, error: null },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ project_id: "bad-id" }),
      })
    );
    expect(res.status).toBe(404);
  });
});
