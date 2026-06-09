import { getToday } from "@/lib/dates";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerJournalTools } from "@/lib/mcp/tools/journal";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["journal:read", "journal:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };
const otherCtx = { userId: OTHER_USER_ID, scopes: SCOPES };

const TODAY = getToday();

interface JournalEntry {
  id: string;
  userId: string;
  entryDate: string;
  content: string;
  mood: number | null;
  createdAt: string;
  updatedAt: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerJournalTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("journal tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("get_journal_entries", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects reads missing journal:read", async () => {
    const res = await h.call("get_journal_entries", {}, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("journal:read");
  });

  it("rejects writes missing journal:write", async () => {
    const res = await h.call(
      "create_journal_entry",
      { content: "hi" },
      { userId: TEST_USER_ID, scopes: ["journal:read"] }
    );
    expect(expectError(res)).toContain("journal:write");
  });

  it("rejects search missing journal:read", async () => {
    const res = await h.call("search_journal", { query: "x" }, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("journal:read");
  });
});

describe("create_journal_entry + get_journal_entries", () => {
  it("creates an entry and fetches it by date", async () => {
    const created = expectOk<JournalEntry>(
      await h.call("create_journal_entry", { content: "Felt great today", entry_date: "2026-06-01", mood: 5 }, ctx)
    );
    expect(created.content).toBe("Felt great today");
    expect(created.entryDate).toBe("2026-06-01");
    expect(created.mood).toBe(5);

    const fetched = expectOk<JournalEntry>(await h.call("get_journal_entries", { date: "2026-06-01" }, ctx));
    expect(fetched.id).toBe(created.id);
    expect(fetched.content).toBe("Felt great today");
  });

  it("trims content on create", async () => {
    const created = expectOk<JournalEntry>(
      await h.call("create_journal_entry", { content: "   padded   ", entry_date: "2026-06-02" }, ctx)
    );
    expect(created.content).toBe("padded");
    expect(created.mood).toBeNull();
  });

  it("defaults to today when entry_date is omitted", async () => {
    const created = expectOk<JournalEntry>(await h.call("create_journal_entry", { content: "today entry" }, ctx));
    expect(created.entryDate).toBe(TODAY);

    const fetched = expectOk<JournalEntry>(await h.call("get_journal_entries", { date: TODAY }, ctx));
    expect(fetched.id).toBe(created.id);
  });

  it("returns null for a date with no entry", async () => {
    const fetched = expectOk<JournalEntry | null>(await h.call("get_journal_entries", { date: "2099-01-01" }, ctx));
    expect(fetched).toBeNull();
  });

  it("upserts: a second create for the same date updates content and stays one entry", async () => {
    const first = expectOk<JournalEntry>(
      await h.call("create_journal_entry", { content: "first version", entry_date: "2026-06-03" }, ctx)
    );
    const second = expectOk<JournalEntry>(
      await h.call("create_journal_entry", { content: "second version", entry_date: "2026-06-03", mood: 3 }, ctx)
    );
    // Same row id; content from the second call wins.
    expect(second.id).toBe(first.id);
    expect(second.content).toBe("second version");
    expect(second.mood).toBe(3);

    // Only one entry exists for that date in the recent list.
    const list = expectOk<JournalEntry[]>(
      await h.call("get_journal_entries", { from: "2026-06-03", to: "2026-06-03" }, ctx)
    );
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("second version");
  });
});

describe("get_journal_entries — range & limit", () => {
  async function seedDays(dates: string[]) {
    for (const d of dates) {
      expectOk(await h.call("create_journal_entry", { content: `entry ${d}`, entry_date: d }, ctx));
    }
  }

  it("returns entries within a from/to range, newest first", async () => {
    await seedDays(["2026-05-01", "2026-05-10", "2026-05-20", "2026-06-01"]);
    const list = expectOk<JournalEntry[]>(
      await h.call("get_journal_entries", { from: "2026-05-05", to: "2026-05-25" }, ctx)
    );
    expect(list.map((e) => e.entryDate)).toEqual(["2026-05-20", "2026-05-10"]);
  });

  it("respects from-only (>=) bound", async () => {
    await seedDays(["2026-05-01", "2026-05-10", "2026-05-20"]);
    const list = expectOk<JournalEntry[]>(await h.call("get_journal_entries", { from: "2026-05-10" }, ctx));
    expect(list.map((e) => e.entryDate)).toEqual(["2026-05-20", "2026-05-10"]);
  });

  it("respects to-only (<=) bound", async () => {
    await seedDays(["2026-05-01", "2026-05-10", "2026-05-20"]);
    const list = expectOk<JournalEntry[]>(await h.call("get_journal_entries", { to: "2026-05-10" }, ctx));
    expect(list.map((e) => e.entryDate)).toEqual(["2026-05-10", "2026-05-01"]);
  });

  it("honors the limit parameter", async () => {
    await seedDays(["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"]);
    const list = expectOk<JournalEntry[]>(await h.call("get_journal_entries", { limit: 2 }, ctx));
    expect(list).toHaveLength(2);
    expect(list[0].entryDate).toBe("2026-05-04");
  });
});

describe("search_journal — full-text", () => {
  it("returns only entries whose content matches the query term", async () => {
    expectOk(
      await h.call("create_journal_entry", { content: "Today I went kayaking on the river", entry_date: "2026-04-01" }, ctx)
    );
    expectOk(
      await h.call("create_journal_entry", { content: "Quiet evening reading a novel", entry_date: "2026-04-02" }, ctx)
    );
    expectOk(
      await h.call("create_journal_entry", { content: "Another kayaking adventure at dawn", entry_date: "2026-04-03" }, ctx)
    );

    const results = expectOk<JournalEntry[]>(await h.call("search_journal", { query: "kayaking" }, ctx));
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.content.includes("kayaking"))).toBe(true);
  });

  it("returns an empty list when nothing matches", async () => {
    expectOk(await h.call("create_journal_entry", { content: "ordinary day", entry_date: "2026-04-04" }, ctx));
    const results = expectOk<JournalEntry[]>(await h.call("search_journal", { query: "spaceship" }, ctx));
    expect(results).toHaveLength(0);
  });

  it("does not surface another user's entries", async () => {
    expectOk(
      await h.call("create_journal_entry", { content: "my secret kayaking spot", entry_date: "2026-04-05" }, otherCtx)
    );
    const results = expectOk<JournalEntry[]>(await h.call("search_journal", { query: "kayaking" }, ctx));
    expect(results).toHaveLength(0);
  });
});

describe("create_journal_entry — optimistic concurrency", () => {
  it("updates when expected_updated_at matches the current version", async () => {
    const created = expectOk<JournalEntry>(
      await h.call("create_journal_entry", { content: "v1", entry_date: "2026-03-01" }, ctx)
    );

    const updated = expectOk<JournalEntry>(
      await h.call(
        "create_journal_entry",
        { content: "v2", entry_date: "2026-03-01", expected_updated_at: created.updatedAt },
        ctx
      )
    );
    expect(updated.id).toBe(created.id);
    expect(updated.content).toBe("v2");
  });

  it("returns a conflict for a stale expected_updated_at", async () => {
    expectOk(await h.call("create_journal_entry", { content: "v1", entry_date: "2026-03-02" }, ctx));
    const stale = "2000-01-01T00:00:00.000Z";

    const res = await h.call(
      "create_journal_entry",
      { content: "v2", entry_date: "2026-03-02", expected_updated_at: stale },
      ctx
    );
    expect(res.isError).toBe(true);
    expect(expectError(res)).toContain("conflict");
  });

  it("returns not found when expected_updated_at is passed but no entry exists", async () => {
    const res = await h.call(
      "create_journal_entry",
      { content: "v1", entry_date: "2026-03-03", expected_updated_at: "2026-03-03T00:00:00.000Z" },
      ctx
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("create_journal_entry — mood validation", () => {
  it("rejects an out-of-range mood at the zod layer", async () => {
    await expect(h.call("create_journal_entry", { content: "bad mood", mood: 6 }, ctx)).rejects.toThrow();
  });
});

describe("delete_journal_entry", () => {
  it("deletes an entry by date so a later fetch returns null", async () => {
    expectOk(await h.call("create_journal_entry", { content: "to delete", entry_date: "2026-02-01" }, ctx));

    const del = expectOk<{ success: boolean }>(await h.call("delete_journal_entry", { entry_date: "2026-02-01" }, ctx));
    expect(del.success).toBe(true);

    const fetched = expectOk<JournalEntry | null>(await h.call("get_journal_entries", { date: "2026-02-01" }, ctx));
    expect(fetched).toBeNull();
  });

  it("returns not found when deleting a date with no entry", async () => {
    const res = await h.call("delete_journal_entry", { entry_date: "2026-02-02" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not delete another user's entry (cross-user isolation)", async () => {
    expectOk(await h.call("create_journal_entry", { content: "mine", entry_date: "2026-02-03" }, ctx));

    // Other user attempts to delete the same date — sees not found.
    const res = await h.call("delete_journal_entry", { entry_date: "2026-02-03" }, otherCtx);
    expect(expectError(res)).toContain("not found");

    // Original entry is still intact.
    const fetched = expectOk<JournalEntry>(await h.call("get_journal_entries", { date: "2026-02-03" }, ctx));
    expect(fetched.content).toBe("mine");
  });

  it("does not read another user's entry by date", async () => {
    expectOk(await h.call("create_journal_entry", { content: "private", entry_date: "2026-02-04" }, ctx));
    const fetched = expectOk<JournalEntry | null>(
      await h.call("get_journal_entries", { date: "2026-02-04" }, otherCtx)
    );
    expect(fetched).toBeNull();
  });
});
