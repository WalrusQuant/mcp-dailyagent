import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerReviewTools } from "@/lib/mcp/tools/reviews";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const READ = ["review:read"];
const WRITE = ["review:write"];
const ALL = [...READ, ...WRITE];
const ctx = { userId: TEST_USER_ID, scopes: ALL };

interface Review {
  id: string;
  userId: string;
  weekStart: string;
  content: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerReviewTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("review tools — auth & scope", () => {
  it("rejects unauthenticated get", async () => {
    const res = await h.call("get_weekly_review", {}, { scopes: ALL });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects unauthenticated save", async () => {
    const res = await h.call(
      "save_weekly_review",
      { week_start: "2026-06-01", content: "x" },
      { scopes: ALL }
    );
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("get requires review:read scope", async () => {
    const res = await h.call("get_weekly_review", {}, { userId: TEST_USER_ID, scopes: WRITE });
    expect(expectError(res)).toContain("review:read");
  });

  it("save requires review:write scope", async () => {
    const res = await h.call(
      "save_weekly_review",
      { week_start: "2026-06-01", content: "x" },
      { userId: TEST_USER_ID, scopes: READ }
    );
    expect(expectError(res)).toContain("review:write");
  });
});

describe("save_weekly_review + get_weekly_review", () => {
  it("saves a review and gets it back for the same week", async () => {
    const saved = expectOk<Review>(
      await h.call(
        "save_weekly_review",
        { week_start: "2026-06-01", content: "Good week" },
        ctx
      )
    );
    expect(saved.weekStart).toBe("2026-06-01");
    expect(saved.content).toBe("Good week");
    expect(saved.userId).toBe(TEST_USER_ID);

    const got = expectOk<Review>(
      await h.call("get_weekly_review", { week_start: "2026-06-01" }, ctx)
    );
    expect(got.id).toBe(saved.id);
    expect(got.content).toBe("Good week");
  });

  it("upserts: saving twice for the same week updates content, keeps same row", async () => {
    const first = expectOk<Review>(
      await h.call("save_weekly_review", { week_start: "2026-06-01", content: "v1" }, ctx)
    );
    const second = expectOk<Review>(
      await h.call("save_weekly_review", { week_start: "2026-06-01", content: "v2" }, ctx)
    );

    expect(second.id).toBe(first.id);
    expect(second.content).toBe("v2");

    const got = expectOk<Review>(
      await h.call("get_weekly_review", { week_start: "2026-06-01" }, ctx)
    );
    expect(got.content).toBe("v2");
  });

  it("get for a week with no review returns the empty message", async () => {
    const res = expectOk<{ message: string }>(
      await h.call("get_weekly_review", { week_start: "2030-01-06" }, ctx)
    );
    expect(res.message).toContain("No weekly review");
  });

  it("get without week_start returns the latest review", async () => {
    expectOk(await h.call("save_weekly_review", { week_start: "2026-05-25", content: "older" }, ctx));
    expectOk(await h.call("save_weekly_review", { week_start: "2026-06-01", content: "newer" }, ctx));

    const got = expectOk<Review>(await h.call("get_weekly_review", {}, ctx));
    expect(got.weekStart).toBe("2026-06-01");
    expect(got.content).toBe("newer");
  });

  it("get without week_start and no reviews returns the empty message", async () => {
    const res = expectOk<{ message: string }>(await h.call("get_weekly_review", {}, ctx));
    expect(res.message).toContain("No weekly review");
  });
});

describe("review tools — cross-user isolation", () => {
  it("does not return another user's review by week", async () => {
    expectOk(
      await h.call("save_weekly_review", { week_start: "2026-06-01", content: "mine" }, ctx)
    );

    const res = expectOk<{ message: string }>(
      await h.call(
        "get_weekly_review",
        { week_start: "2026-06-01" },
        { userId: OTHER_USER_ID, scopes: ALL }
      )
    );
    expect(res.message).toContain("No weekly review");
  });

  it("does not return another user's latest review", async () => {
    expectOk(
      await h.call("save_weekly_review", { week_start: "2026-06-01", content: "mine" }, ctx)
    );

    const res = expectOk<{ message: string }>(
      await h.call("get_weekly_review", {}, { userId: OTHER_USER_ID, scopes: ALL })
    );
    expect(res.message).toContain("No weekly review");
  });

  it("allows two users to hold reviews for the same week independently", async () => {
    expectOk(await h.call("save_weekly_review", { week_start: "2026-06-01", content: "mine" }, ctx));
    expectOk(
      await h.call(
        "save_weekly_review",
        { week_start: "2026-06-01", content: "theirs" },
        { userId: OTHER_USER_ID, scopes: ALL }
      )
    );

    const mine = expectOk<Review>(
      await h.call("get_weekly_review", { week_start: "2026-06-01" }, ctx)
    );
    const theirs = expectOk<Review>(
      await h.call(
        "get_weekly_review",
        { week_start: "2026-06-01" },
        { userId: OTHER_USER_ID, scopes: ALL }
      )
    );
    expect(mine.content).toBe("mine");
    expect(theirs.content).toBe("theirs");
  });
});
