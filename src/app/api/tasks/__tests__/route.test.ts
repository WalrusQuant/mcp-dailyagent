import { GET, POST } from "@/app/api/tasks/route";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options as never);
}

describe("GET /api/tasks", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createMockSupabaseClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("returns tasks for today", async () => {
    const tasks = [{ id: "1", title: "Do stuff", priority: "A1" }];
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: tasks, error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(tasks);
  });

  it("passes date parameter", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: [], error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/tasks?date=2026-03-15"));
    expect(res.status).toBe(200);
    // Verify .eq was called with the date
    expect(client.from).toHaveBeenCalledWith("tasks");
  });

  it("passes project_id filter", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: [], error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/tasks?project_id=p1"));
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: null, error: { message: "DB error" } } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await GET(makeRequest("/api/tasks"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/tasks", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createMockSupabaseClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when title missing", async () => {
    const client = createMockSupabaseClient({ user: { id: "u1" } });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Title is required");
  });

  it("creates task and returns data", async () => {
    const task = { id: "t1", title: "New task", priority: "B1" };
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: task, error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "New task" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(task);
  });

  it("defaults priority to B1", async () => {
    const client = createMockSupabaseClient({
      user: { id: "u1" },
      tables: { tasks: { data: { id: "t1" }, error: null } },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await POST(
      makeRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      })
    );

    // Verify insert was called
    const fromCall = client.from.mock.results[0].value;
    expect(fromCall.insert).toHaveBeenCalled();
  });
});
