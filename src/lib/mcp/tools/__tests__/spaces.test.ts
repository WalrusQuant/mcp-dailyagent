import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerSpaceTools } from "@/lib/mcp/tools/spaces";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["spaces:read", "spaces:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };

interface SpaceRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerSpaceTools);
});

beforeEach(async () => {
  await resetDb();
});

async function seedSpace(name = "Work", description?: string) {
  return expectOk<SpaceRow>(
    await h.call("create_space", description ? { name, description } : { name }, ctx)
  );
}

describe("space tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("list_spaces", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects calls missing the read scope", async () => {
    const res = await h.call("list_spaces", {}, { userId: TEST_USER_ID });
    expect(expectError(res)).toContain("spaces:read");
  });

  it("rejects calls missing the write scope", async () => {
    const res = await h.call("create_space", { name: "x" }, { userId: TEST_USER_ID });
    expect(expectError(res)).toContain("spaces:write");
  });
});

describe("create_space + list_spaces", () => {
  it("creates a space with status active and lists it", async () => {
    const created = await seedSpace("Health", "Fitness + nutrition");
    expect(created.name).toBe("Health");
    expect(created.description).toBe("Fitness + nutrition");
    expect(created.status).toBe("active");

    const list = expectOk<SpaceRow[]>(await h.call("list_spaces", {}, ctx));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("creates a space without a description (null)", async () => {
    const created = await seedSpace("Solo");
    expect(created.description).toBeNull();
  });

  it("lists multiple spaces for the user", async () => {
    await seedSpace("One");
    await seedSpace("Two");
    const list = expectOk<SpaceRow[]>(await h.call("list_spaces", {}, ctx));
    expect(list).toHaveLength(2);
  });

  it("does not list another user's spaces", async () => {
    await seedSpace("Mine");
    const list = expectOk<SpaceRow[]>(
      await h.call("list_spaces", {}, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(list).toHaveLength(0);
  });
});

describe("update_space — legacy path", () => {
  it("updates name, description, and status", async () => {
    const space = await seedSpace("Old", "old desc");
    const updated = expectOk<SpaceRow>(
      await h.call(
        "update_space",
        { space_id: space.id, name: "New", description: "new desc", status: "paused" },
        ctx
      )
    );
    expect(updated.name).toBe("New");
    expect(updated.description).toBe("new desc");
    expect(updated.status).toBe("paused");
  });

  it("returns not found for an unknown space id", async () => {
    const res = await h.call("update_space", { space_id: OTHER_USER_ID, name: "x" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not update another user's space", async () => {
    const space = await seedSpace("Private");
    const res = await h.call(
      "update_space",
      { space_id: space.id, name: "Hacked" },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("update_space — optimistic concurrency", () => {
  it("succeeds when the expected_updated_at matches the current row", async () => {
    const space = await seedSpace("Versioned");
    const updated = expectOk<SpaceRow>(
      await h.call(
        "update_space",
        { space_id: space.id, expected_updated_at: space.updatedAt, name: "Bumped" },
        ctx
      )
    );
    expect(updated.name).toBe("Bumped");
    // updatedAt should advance after a versioned write.
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(space.updatedAt).getTime()
    );
  });

  it("returns a conflict when expected_updated_at is stale", async () => {
    const space = await seedSpace("Contended");
    const stale = new Date(new Date(space.updatedAt).getTime() - 60_000).toISOString();
    const res = await h.call(
      "update_space",
      { space_id: space.id, expected_updated_at: stale, name: "Loser" },
      ctx
    );
    const text = expectError(res);
    expect(text).toContain("conflict");

    // The row should be untouched.
    const list = expectOk<SpaceRow[]>(await h.call("list_spaces", {}, ctx));
    expect(list[0].name).toBe("Contended");
  });

  it("returns not found for an unknown id even with a version token", async () => {
    const token = new Date().toISOString();
    const res = await h.call(
      "update_space",
      { space_id: OTHER_USER_ID, expected_updated_at: token, name: "x" },
      ctx
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("delete_space", () => {
  it("deletes an existing space and the list becomes empty", async () => {
    const space = await seedSpace("Temp");
    const res = expectOk<{ success: boolean }>(
      await h.call("delete_space", { space_id: space.id }, ctx)
    );
    expect(res.success).toBe(true);

    const list = expectOk<SpaceRow[]>(await h.call("list_spaces", {}, ctx));
    expect(list).toHaveLength(0);
  });

  it("returns not found for an unknown space", async () => {
    const res = await h.call("delete_space", { space_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not delete another user's space", async () => {
    const space = await seedSpace("Protected");
    const res = await h.call(
      "delete_space",
      { space_id: space.id },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");

    // Still present for the owner.
    const list = expectOk<SpaceRow[]>(await h.call("list_spaces", {}, ctx));
    expect(list).toHaveLength(1);
  });
});
