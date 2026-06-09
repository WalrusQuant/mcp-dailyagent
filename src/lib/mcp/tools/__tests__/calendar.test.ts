import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerCalendarTools } from "@/lib/mcp/tools/calendar";
import { registerTaskTools } from "@/lib/mcp/tools/tasks";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["calendar:read"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };
const taskCtx = { userId: TEST_USER_ID, scopes: ["tasks:write"] };

// A fixed past date so the day-summary's "prior incomplete tasks roll into
// today" branch never fires — the queried date is not today.
const DAY = "2026-06-01";
const WEEK_START = "2026-06-01"; // a Monday

interface DaySummary {
  date: string;
  tasks: { total: number; completed: number; items: { id: string; title: string; done: boolean }[] };
  habits: { completed: number; items: unknown[] };
  journal: unknown | null;
  workouts: unknown[];
  focus: { totalMinutes: number; sessionCount: number };
}

interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  tasks: { total: number; completed: number; completionRate: number };
  habits: { totalCompletions: number };
  workouts: { count: number; totalMinutes: number };
  focus: { totalMinutes: number; sessionCount: number };
  journal: { entriesWritten: number; averageMood: number | null };
}

let h: ReturnType<typeof createToolHarness>;
let tasksH: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerCalendarTools);
  tasksH = createToolHarness(registerTaskTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("calendar tools — auth & scope", () => {
  it("rejects unauthenticated get_day_summary", async () => {
    const res = await h.call("get_day_summary", { date: DAY }, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects unauthenticated get_week_summary", async () => {
    const res = await h.call("get_week_summary", { week_start: WEEK_START }, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("get_day_summary requires calendar:read scope", async () => {
    const res = await h.call("get_day_summary", { date: DAY }, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("calendar:read");
  });

  it("get_week_summary requires calendar:read scope", async () => {
    const res = await h.call(
      "get_week_summary",
      { week_start: WEEK_START },
      { userId: TEST_USER_ID, scopes: [] }
    );
    expect(expectError(res)).toContain("calendar:read");
  });
});

describe("get_day_summary", () => {
  it("returns a well-formed empty summary for a day with no data", async () => {
    const s = expectOk<DaySummary>(await h.call("get_day_summary", { date: DAY }, ctx));
    expect(s.date).toBe(DAY);
    expect(s.tasks).toEqual({ total: 0, completed: 0, items: [] });
    expect(s.habits).toEqual({ completed: 0, items: [] });
    expect(s.journal).toBeNull();
    expect(s.workouts).toEqual([]);
    expect(s.focus).toEqual({ totalMinutes: 0, sessionCount: 0 });
  });

  it("reflects a seeded task in the day summary", async () => {
    expectOk(
      await tasksH.call("create_task", { title: "Write report", task_date: DAY, priority: "A1" }, taskCtx)
    );

    const s = expectOk<DaySummary>(await h.call("get_day_summary", { date: DAY }, ctx));
    expect(s.tasks.total).toBe(1);
    expect(s.tasks.completed).toBe(0);
    expect(s.tasks.items).toHaveLength(1);
    expect(s.tasks.items[0].title).toBe("Write report");
  });

  it("counts completed tasks separately from total", async () => {
    const a = expectOk<{ id: string }>(
      await tasksH.call("create_task", { title: "A", task_date: DAY }, taskCtx)
    );
    expectOk(await tasksH.call("create_task", { title: "B", task_date: DAY }, taskCtx));
    expectOk(await tasksH.call("complete_task", { task_id: a.id }, taskCtx));

    const s = expectOk<DaySummary>(await h.call("get_day_summary", { date: DAY }, ctx));
    expect(s.tasks.total).toBe(2);
    expect(s.tasks.completed).toBe(1);
  });

  it("does not include another user's tasks", async () => {
    expectOk(await tasksH.call("create_task", { title: "Mine", task_date: DAY }, taskCtx));

    const s = expectOk<DaySummary>(
      await h.call("get_day_summary", { date: DAY }, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(s.tasks.total).toBe(0);
  });
});

describe("get_week_summary", () => {
  it("returns a well-formed empty week summary", async () => {
    const s = expectOk<WeekSummary>(await h.call("get_week_summary", { week_start: WEEK_START }, ctx));
    expect(s.weekStart).toBe(WEEK_START);
    expect(s.weekEnd).toBe("2026-06-07");
    expect(s.tasks).toEqual({ total: 0, completed: 0, completionRate: 0 });
    expect(s.habits).toEqual({ totalCompletions: 0 });
    expect(s.workouts).toEqual({ count: 0, totalMinutes: 0 });
    expect(s.focus).toEqual({ totalMinutes: 0, sessionCount: 0 });
    expect(s.journal).toEqual({ entriesWritten: 0, averageMood: null });
  });

  it("aggregates tasks across the week with a completion rate", async () => {
    const a = expectOk<{ id: string }>(
      await tasksH.call("create_task", { title: "Mon task", task_date: "2026-06-01" }, taskCtx)
    );
    expectOk(await tasksH.call("create_task", { title: "Wed task", task_date: "2026-06-03" }, taskCtx));
    // A task outside the week window must not be counted.
    expectOk(await tasksH.call("create_task", { title: "Next week", task_date: "2026-06-08" }, taskCtx));
    expectOk(await tasksH.call("complete_task", { task_id: a.id }, taskCtx));

    const s = expectOk<WeekSummary>(await h.call("get_week_summary", { week_start: WEEK_START }, ctx));
    expect(s.tasks.total).toBe(2);
    expect(s.tasks.completed).toBe(1);
    expect(s.tasks.completionRate).toBe(50);
  });

  it("does not include another user's tasks", async () => {
    expectOk(await tasksH.call("create_task", { title: "Mine", task_date: "2026-06-02" }, taskCtx));

    const s = expectOk<WeekSummary>(
      await h.call("get_week_summary", { week_start: WEEK_START }, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(s.tasks.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// queries/calendar.ts getWeekSummary (used by the calendar-week resource):
// expected habit counts must derive from the *requested* week, not the
// current month's calendar grid — past weeks used to report 0 expected.
// ---------------------------------------------------------------------------
import { getWeekSummary as getWeekSummaryQuery } from "@/lib/mcp/queries/calendar";
import { getTestDb } from "@/test/db-harness";
import { habits } from "@/lib/db/schema";

describe("queries getWeekSummary — expected habits for past weeks", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reports expected habit totals for a week far outside the current month", async () => {
    const { db } = await getTestDb();
    await db.insert(habits).values({
      userId: TEST_USER_ID,
      name: "Daily habit",
      targetDays: [1, 2, 3, 4, 5, 6, 7],
    });
    await db.insert(habits).values({
      userId: TEST_USER_ID,
      name: "Weekday habit",
      targetDays: [1, 2, 3, 4, 5],
    });

    // 2026-03-02 is a Monday months away from "today".
    const result = await getWeekSummaryQuery(TEST_USER_ID, "2026-03-02");
    expect(result.error).toBeNull();
    const days = result.data!.days as Record<string, { habits: { total: number } }>;

    // Mon-Fri expect both habits, Sat/Sun only the daily one.
    expect(days["2026-03-02"].habits.total).toBe(2);
    expect(days["2026-03-06"].habits.total).toBe(2);
    expect(days["2026-03-07"].habits.total).toBe(1);
    expect(days["2026-03-08"].habits.total).toBe(1);
  });
});
