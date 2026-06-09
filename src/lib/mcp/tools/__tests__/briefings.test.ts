import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerBriefingTools } from "@/lib/mcp/tools/briefings";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const READ = ["briefing:read"];
const WRITE = ["briefing:write"];
const ALL = [...READ, ...WRITE];
const ctx = { userId: TEST_USER_ID, scopes: ALL };

const TODAY = new Date().toISOString().split("T")[0];

interface Briefing {
  id: string;
  userId: string;
  briefingDate: string;
  content: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerBriefingTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("briefing tools — auth & scope", () => {
  it("rejects unauthenticated get", async () => {
    const res = await h.call("get_daily_briefing", {}, { scopes: ALL });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects unauthenticated save", async () => {
    const res = await h.call("save_daily_briefing", { content: "x" }, { scopes: ALL });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("get requires briefing:read scope", async () => {
    const res = await h.call("get_daily_briefing", {}, { userId: TEST_USER_ID, scopes: WRITE });
    expect(expectError(res)).toContain("briefing:read");
  });

  it("save requires briefing:write scope", async () => {
    const res = await h.call(
      "save_daily_briefing",
      { content: "x" },
      { userId: TEST_USER_ID, scopes: READ }
    );
    expect(expectError(res)).toContain("briefing:write");
  });
});

describe("save_daily_briefing + get_daily_briefing", () => {
  it("saves for an explicit date and reflects it in the row", async () => {
    const saved = expectOk<Briefing>(
      await h.call(
        "save_daily_briefing",
        { briefing_date: "2026-06-01", content: "Plan the day" },
        ctx
      )
    );
    expect(saved.briefingDate).toBe("2026-06-01");
    expect(saved.content).toBe("Plan the day");
    expect(saved.userId).toBe(TEST_USER_ID);
  });

  it("defaults briefing_date to today when omitted, and get returns it", async () => {
    const saved = expectOk<Briefing>(
      await h.call("save_daily_briefing", { content: "Today's briefing" }, ctx)
    );
    expect(saved.briefingDate).toBe(TODAY);

    const got = expectOk<Briefing>(await h.call("get_daily_briefing", {}, ctx));
    expect(got.id).toBe(saved.id);
    expect(got.content).toBe("Today's briefing");
  });

  it("upserts: saving twice for the same date updates content, keeps same row", async () => {
    const first = expectOk<Briefing>(
      await h.call("save_daily_briefing", { briefing_date: TODAY, content: "v1" }, ctx)
    );
    const second = expectOk<Briefing>(
      await h.call("save_daily_briefing", { briefing_date: TODAY, content: "v2" }, ctx)
    );
    expect(second.id).toBe(first.id);
    expect(second.content).toBe("v2");

    const got = expectOk<Briefing>(await h.call("get_daily_briefing", {}, ctx));
    expect(got.content).toBe("v2");
  });

  it("get returns the empty message when no briefing is saved for today", async () => {
    // A briefing saved for a different (non-today) date must not surface.
    expectOk(
      await h.call("save_daily_briefing", { briefing_date: "2026-06-01", content: "old" }, ctx)
    );
    const res = expectOk<{ message: string }>(await h.call("get_daily_briefing", {}, ctx));
    expect(res.message).toContain("No briefing");
  });
});

describe("briefing tools — cross-user isolation", () => {
  it("does not return another user's briefing", async () => {
    expectOk(await h.call("save_daily_briefing", { briefing_date: TODAY, content: "mine" }, ctx));

    const res = expectOk<{ message: string }>(
      await h.call("get_daily_briefing", {}, { userId: OTHER_USER_ID, scopes: ALL })
    );
    expect(res.message).toContain("No briefing");
  });

  it("lets two users hold a briefing for the same date independently", async () => {
    expectOk(await h.call("save_daily_briefing", { briefing_date: TODAY, content: "mine" }, ctx));
    expectOk(
      await h.call(
        "save_daily_briefing",
        { briefing_date: TODAY, content: "theirs" },
        { userId: OTHER_USER_ID, scopes: ALL }
      )
    );

    const mine = expectOk<Briefing>(await h.call("get_daily_briefing", {}, ctx));
    const theirs = expectOk<Briefing>(
      await h.call("get_daily_briefing", {}, { userId: OTHER_USER_ID, scopes: ALL })
    );
    expect(mine.content).toBe("mine");
    expect(theirs.content).toBe("theirs");
  });
});
