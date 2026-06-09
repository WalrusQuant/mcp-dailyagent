import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerGoalTools } from "@/lib/mcp/tools/goals";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["goals:read", "goals:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };
const otherCtx = { userId: OTHER_USER_ID, scopes: SCOPES };

interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  status: "active" | "completed" | "abandoned";
  progress: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerGoalTools);
});

beforeEach(async () => {
  await resetDb();
});

async function seedGoal(args: Record<string, unknown> = {}, c = ctx): Promise<Goal> {
  return expectOk<Goal>(await h.call("create_goal", { title: "A Goal", ...args }, c));
}

describe("goal tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("list_goals", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects reads missing goals:read", async () => {
    const res = await h.call("list_goals", {}, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("goals:read");
  });

  it("rejects writes missing goals:write", async () => {
    const res = await h.call(
      "create_goal",
      { title: "x" },
      { userId: TEST_USER_ID, scopes: ["goals:read"] }
    );
    expect(expectError(res)).toContain("goals:write");
  });
});

describe("create_goal + list_goals", () => {
  it("creates a goal with defaults and lists it", async () => {
    const created = await seedGoal({ title: "Run a marathon", description: "26.2 miles", target_date: "2026-12-31" });
    expect(created.title).toBe("Run a marathon");
    expect(created.description).toBe("26.2 miles");
    expect(created.targetDate).toBe("2026-12-31");
    expect(created.status).toBe("active");
    expect(created.progress).toBe(0);

    const list = expectOk<Goal[]>(await h.call("list_goals", {}, ctx));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("trims the title and accepts a category", async () => {
    const created = await seedGoal({ title: "   Read more   ", category: "learning" });
    expect(created.title).toBe("Read more");
    expect(created.category).toBe("learning");
  });

  it("rejects an invalid category at the zod layer", async () => {
    await expect(h.call("create_goal", { title: "x", category: "nonsense" }, ctx)).rejects.toThrow();
  });
});

describe("list_goals — status filter", () => {
  it("filters by status", async () => {
    const active = await seedGoal({ title: "Active goal" });
    const done = await seedGoal({ title: "Done goal" });
    expectOk(await h.call("update_goal", { goal_id: done.id, status: "completed" }, ctx));

    const activeOnly = expectOk<Goal[]>(await h.call("list_goals", { status: "active" }, ctx));
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe(active.id);

    const completedOnly = expectOk<Goal[]>(await h.call("list_goals", { status: "completed" }, ctx));
    expect(completedOnly).toHaveLength(1);
    expect(completedOnly[0].id).toBe(done.id);

    const all = expectOk<Goal[]>(await h.call("list_goals", {}, ctx));
    expect(all).toHaveLength(2);
  });

  it("rejects an invalid status filter at the zod layer", async () => {
    await expect(h.call("list_goals", { status: "paused" }, ctx)).rejects.toThrow();
  });
});

describe("update_goal — legacy path", () => {
  it("updates title, description, status, and progress", async () => {
    const goal = await seedGoal({ title: "Original" });
    const updated = expectOk<Goal>(
      await h.call(
        "update_goal",
        { goal_id: goal.id, title: "Renamed", description: "new desc", status: "completed", progress: 80 },
        ctx
      )
    );
    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("new desc");
    expect(updated.status).toBe("completed");
    expect(updated.progress).toBe(80);
  });

  it("returns not found for an unknown goal id", async () => {
    const res = await h.call("update_goal", { goal_id: OTHER_USER_ID, title: "x" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not update another user's goal", async () => {
    const goal = await seedGoal({ title: "Mine" });
    const res = await h.call("update_goal", { goal_id: goal.id, title: "Hacked" }, otherCtx);
    expect(expectError(res)).toContain("not found");
  });
});

describe("update_goal — optimistic concurrency", () => {
  it("updates when expected_updated_at matches", async () => {
    const goal = await seedGoal({ title: "Versioned" });
    const updated = expectOk<Goal>(
      await h.call(
        "update_goal",
        { goal_id: goal.id, title: "New", expected_updated_at: goal.updatedAt },
        ctx
      )
    );
    expect(updated.title).toBe("New");
  });

  it("returns a conflict for a stale expected_updated_at", async () => {
    const goal = await seedGoal({ title: "Versioned" });
    const res = await h.call(
      "update_goal",
      { goal_id: goal.id, title: "New", expected_updated_at: "2000-01-01T00:00:00.000Z" },
      ctx
    );
    expect(res.isError).toBe(true);
    expect(expectError(res)).toContain("conflict");
  });

  it("returns not found via the concurrency path for an unknown goal", async () => {
    const res = await h.call(
      "update_goal",
      { goal_id: OTHER_USER_ID, title: "x", expected_updated_at: "2026-01-01T00:00:00.000Z" },
      ctx
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("log_goal_progress", () => {
  it("updates the goal's progress percentage", async () => {
    const goal = await seedGoal({ title: "Track me" });
    const updated = expectOk<Goal>(await h.call("log_goal_progress", { goal_id: goal.id, progress: 42 }, ctx));
    expect(updated.id).toBe(goal.id);
    expect(updated.progress).toBe(42);

    const fetched = expectOk<Goal[]>(await h.call("list_goals", {}, ctx));
    expect(fetched[0].progress).toBe(42);
  });

  it("returns not found for an unknown goal id", async () => {
    const res = await h.call("log_goal_progress", { goal_id: OTHER_USER_ID, progress: 10 }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not log progress on another user's goal", async () => {
    const goal = await seedGoal({ title: "Mine" });
    const res = await h.call("log_goal_progress", { goal_id: goal.id, progress: 50 }, otherCtx);
    expect(expectError(res)).toContain("not found");
  });

  it("rejects out-of-range progress at the zod layer", async () => {
    const goal = await seedGoal({ title: "Mine" });
    await expect(h.call("log_goal_progress", { goal_id: goal.id, progress: 150 }, ctx)).rejects.toThrow();
  });

  it("rejects a float progress value at the zod layer", async () => {
    const goal = await seedGoal({ title: "Mine" });
    await expect(h.call("log_goal_progress", { goal_id: goal.id, progress: 50.5 }, ctx)).rejects.toThrow();
  });
});

describe("update_goal — progress float rejection", () => {
  it("rejects a float progress value at the zod layer", async () => {
    const goal = await seedGoal({ title: "Float test" });
    await expect(h.call("update_goal", { goal_id: goal.id, progress: 33.3 }, ctx)).rejects.toThrow();
  });
});

describe("delete_goal", () => {
  it("deletes a goal (and cascades its progress logs)", async () => {
    const goal = await seedGoal({ title: "Temporary" });
    // Create a progress log row so the cascade has something to remove.
    expectOk(await h.call("log_goal_progress", { goal_id: goal.id, progress: 30 }, ctx));

    const del = expectOk<{ success: boolean }>(await h.call("delete_goal", { goal_id: goal.id }, ctx));
    expect(del.success).toBe(true);

    const list = expectOk<Goal[]>(await h.call("list_goals", {}, ctx));
    expect(list).toHaveLength(0);
  });

  it("returns not found for an unknown goal", async () => {
    const res = await h.call("delete_goal", { goal_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not delete another user's goal", async () => {
    const goal = await seedGoal({ title: "Mine" });
    const res = await h.call("delete_goal", { goal_id: goal.id }, otherCtx);
    expect(expectError(res)).toContain("not found");

    const list = expectOk<Goal[]>(await h.call("list_goals", {}, ctx));
    expect(list).toHaveLength(1);
  });
});
