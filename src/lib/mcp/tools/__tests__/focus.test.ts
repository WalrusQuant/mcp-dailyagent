import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerFocusTools } from "@/lib/mcp/tools/focus";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["focus:read", "focus:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };

interface SessionRow {
  id: string;
  status: string;
  durationMinutes: number;
  completedAt: string | null;
  startedAt: string;
  updatedAt: string;
}

interface FocusStats {
  date: string;
  totalSessions: number;
  completedSessions: number;
  totalFocusMinutes: number;
  sessions: SessionRow[];
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerFocusTools);
});

beforeEach(async () => {
  await resetDb();
});

async function startSession(duration = 25) {
  return expectOk<SessionRow>(
    await h.call("start_focus_session", { duration_minutes: duration }, ctx)
  );
}

describe("focus tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("get_focus_sessions", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects read calls missing the read scope", async () => {
    const res = await h.call("get_focus_sessions", {}, { userId: TEST_USER_ID });
    expect(expectError(res)).toContain("focus:read");
  });

  it("rejects write calls missing the write scope", async () => {
    const res = await h.call(
      "start_focus_session",
      { duration_minutes: 25 },
      { userId: TEST_USER_ID, scopes: ["focus:read"] }
    );
    expect(expectError(res)).toContain("focus:write");
  });
});

describe("start_focus_session + get_focus_sessions", () => {
  it("starts a session with status active", async () => {
    const session = await startSession(25);
    expect(session.status).toBe("active");
    expect(session.durationMinutes).toBe(25);
    expect(session.completedAt).toBeNull();
  });

  it("lists started sessions", async () => {
    const session = await startSession();
    const list = expectOk<SessionRow[]>(await h.call("get_focus_sessions", {}, ctx));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(session.id);
  });

  it("does not list another user's sessions", async () => {
    await startSession();
    const list = expectOk<SessionRow[]>(
      await h.call("get_focus_sessions", {}, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(list).toHaveLength(0);
  });
});

describe("get_focus_stats", () => {
  it("reports zeros when there are no sessions today", async () => {
    const stats = expectOk<FocusStats>(await h.call("get_focus_stats", {}, ctx));
    expect(stats.totalSessions).toBe(0);
    expect(stats.completedSessions).toBe(0);
    expect(stats.totalFocusMinutes).toBe(0);
  });

  it("reflects a completed session and its minutes", async () => {
    const session = await startSession(30);
    expectOk(await h.call("complete_focus_session", { session_id: session.id }, ctx));

    const stats = expectOk<FocusStats>(await h.call("get_focus_stats", {}, ctx));
    expect(stats.totalSessions).toBe(1);
    expect(stats.completedSessions).toBe(1);
    expect(stats.totalFocusMinutes).toBe(30);
  });

  it("counts an in-progress session as total but not completed", async () => {
    await startSession(15);
    const stats = expectOk<FocusStats>(await h.call("get_focus_stats", {}, ctx));
    expect(stats.totalSessions).toBe(1);
    expect(stats.completedSessions).toBe(0);
    expect(stats.totalFocusMinutes).toBe(0);
  });
});

describe("complete_focus_session", () => {
  it("sets status completed and completedAt (legacy path)", async () => {
    const session = await startSession();
    const completed = expectOk<SessionRow>(
      await h.call("complete_focus_session", { session_id: session.id }, ctx)
    );
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
  });

  it("completes via optimistic concurrency when the token matches", async () => {
    const session = await startSession();
    const completed = expectOk<SessionRow>(
      await h.call(
        "complete_focus_session",
        { session_id: session.id, expected_updated_at: session.updatedAt },
        ctx
      )
    );
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
  });

  it("returns a conflict when expected_updated_at is stale", async () => {
    const session = await startSession();
    const stale = new Date(new Date(session.updatedAt).getTime() - 60_000).toISOString();
    const res = await h.call(
      "complete_focus_session",
      { session_id: session.id, expected_updated_at: stale },
      ctx
    );
    expect(expectError(res)).toContain("conflict");
  });

  it("returns not found for an unknown session id", async () => {
    const res = await h.call("complete_focus_session", { session_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not complete another user's session", async () => {
    const session = await startSession();
    const res = await h.call(
      "complete_focus_session",
      { session_id: session.id },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("pause_focus_session + resume_focus_session", () => {
  it("pauses then resumes a session (paused -> active round trip)", async () => {
    const session = await startSession();

    const paused = expectOk<SessionRow>(
      await h.call("pause_focus_session", { session_id: session.id }, ctx)
    );
    expect(paused.status).toBe("paused");

    const resumed = expectOk<SessionRow>(
      await h.call("resume_focus_session", { session_id: paused.id }, ctx)
    );
    expect(resumed.status).toBe("active");
  });

  it("pauses via optimistic concurrency when the token matches", async () => {
    const session = await startSession();
    const paused = expectOk<SessionRow>(
      await h.call(
        "pause_focus_session",
        { session_id: session.id, expected_updated_at: session.updatedAt },
        ctx
      )
    );
    expect(paused.status).toBe("paused");
  });

  it("returns a conflict on resume when expected_updated_at is stale", async () => {
    const session = await startSession();
    const paused = expectOk<SessionRow>(
      await h.call("pause_focus_session", { session_id: session.id }, ctx)
    );
    const stale = new Date(new Date(paused.updatedAt).getTime() - 60_000).toISOString();
    const res = await h.call(
      "resume_focus_session",
      { session_id: paused.id, expected_updated_at: stale },
      ctx
    );
    expect(expectError(res)).toContain("conflict");
  });

  it("returns not found for pause/resume with an unknown session id", async () => {
    const pauseRes = await h.call("pause_focus_session", { session_id: OTHER_USER_ID }, ctx);
    expect(expectError(pauseRes)).toContain("not found");

    const resumeRes = await h.call("resume_focus_session", { session_id: OTHER_USER_ID }, ctx);
    expect(expectError(resumeRes)).toContain("not found");
  });

  it("does not pause another user's session", async () => {
    const session = await startSession();
    const res = await h.call(
      "pause_focus_session",
      { session_id: session.id },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });
});
