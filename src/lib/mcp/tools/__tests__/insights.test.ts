import { getToday } from "@/lib/dates";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerInsightTools } from "@/lib/mcp/tools/insights";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const READ = ["insights:read"];
const WRITE = ["insights:write"];
const ALL = [...READ, ...WRITE];
const ctx = { userId: TEST_USER_ID, scopes: ALL };

const TODAY = getToday();

interface InsightRow {
  id: string;
  userId: string;
  cacheDate: string;
  insights: unknown;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerInsightTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("insight tools — auth & scope", () => {
  it("rejects unauthenticated get", async () => {
    const res = await h.call("get_insights", {}, { scopes: ALL });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects unauthenticated save", async () => {
    const res = await h.call("save_insights", { insights: [] }, { scopes: ALL });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("get requires insights:read scope", async () => {
    const res = await h.call("get_insights", {}, { userId: TEST_USER_ID, scopes: WRITE });
    expect(expectError(res)).toContain("insights:read");
  });

  it("save requires insights:write scope", async () => {
    const res = await h.call(
      "save_insights",
      { insights: [] },
      { userId: TEST_USER_ID, scopes: READ }
    );
    expect(expectError(res)).toContain("insights:write");
  });
});

describe("save_insights — payload validation", () => {
  it("rejects a null insights payload (schema requires array or object)", async () => {
    await expect(h.call("save_insights", { insights: null }, ctx)).rejects.toThrow();
  });

  it("rejects a string insights payload", async () => {
    await expect(h.call("save_insights", { insights: "nope" }, ctx)).rejects.toThrow();
  });
});

describe("save_insights + get_insights", () => {
  it("saves an array payload and returns it round-tripped", async () => {
    const items = [
      { title: "Streak", body: "5 day habit streak" },
      { title: "Focus", body: "120 min focused today" },
    ];
    const saved = expectOk<InsightRow>(
      await h.call("save_insights", { cache_date: TODAY, insights: items }, ctx)
    );
    expect(saved.cacheDate).toBe(TODAY);
    expect(saved.userId).toBe(TEST_USER_ID);
    expect(saved.insights).toEqual(items);

    const got = expectOk<InsightRow>(await h.call("get_insights", {}, ctx));
    expect(got.id).toBe(saved.id);
    expect(got.insights).toEqual(items);
  });

  it("accepts an object payload too", async () => {
    const obj = { summary: "all good", count: 3 };
    const saved = expectOk<InsightRow>(
      await h.call("save_insights", { cache_date: TODAY, insights: obj }, ctx)
    );
    expect(saved.insights).toEqual(obj);
  });

  it("defaults cache_date to today when omitted, and get returns it", async () => {
    const saved = expectOk<InsightRow>(
      await h.call("save_insights", { insights: [{ title: "x" }] }, ctx)
    );
    expect(saved.cacheDate).toBe(TODAY);

    const got = expectOk<InsightRow>(await h.call("get_insights", {}, ctx));
    expect(got.id).toBe(saved.id);
  });

  it("upserts: saving twice for the same date replaces the payload, keeps same row", async () => {
    const first = expectOk<InsightRow>(
      await h.call("save_insights", { cache_date: TODAY, insights: [{ v: 1 }] }, ctx)
    );
    const second = expectOk<InsightRow>(
      await h.call("save_insights", { cache_date: TODAY, insights: [{ v: 2 }] }, ctx)
    );
    expect(second.id).toBe(first.id);
    expect(second.insights).toEqual([{ v: 2 }]);

    const got = expectOk<InsightRow>(await h.call("get_insights", {}, ctx));
    expect(got.insights).toEqual([{ v: 2 }]);
  });

  it("get returns the empty message when no insights are saved for today", async () => {
    // Saved for a non-today date — must not surface for today's get.
    expectOk(await h.call("save_insights", { cache_date: "2026-06-01", insights: [{ v: 1 }] }, ctx));
    const res = expectOk<{ message: string }>(await h.call("get_insights", {}, ctx));
    expect(res.message).toContain("No insights");
  });
});

describe("insight tools — cross-user isolation", () => {
  it("does not return another user's insights", async () => {
    expectOk(await h.call("save_insights", { cache_date: TODAY, insights: [{ mine: true }] }, ctx));

    const res = expectOk<{ message: string }>(
      await h.call("get_insights", {}, { userId: OTHER_USER_ID, scopes: ALL })
    );
    expect(res.message).toContain("No insights");
  });

  it("lets two users hold insights for the same date independently", async () => {
    expectOk(await h.call("save_insights", { cache_date: TODAY, insights: [{ who: "mine" }] }, ctx));
    expectOk(
      await h.call(
        "save_insights",
        { cache_date: TODAY, insights: [{ who: "theirs" }] },
        { userId: OTHER_USER_ID, scopes: ALL }
      )
    );

    const mine = expectOk<InsightRow>(await h.call("get_insights", {}, ctx));
    const theirs = expectOk<InsightRow>(
      await h.call("get_insights", {}, { userId: OTHER_USER_ID, scopes: ALL })
    );
    expect(mine.insights).toEqual([{ who: "mine" }]);
    expect(theirs.insights).toEqual([{ who: "theirs" }]);
  });
});
