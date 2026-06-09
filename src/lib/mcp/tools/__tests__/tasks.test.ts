import { getToday } from "@/lib/dates";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerTaskTools } from "@/lib/mcp/tools/tasks";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, getTestDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";
import { tasks, goals } from "@/lib/db/schema";

const SCOPES = ["tasks:read", "tasks:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };

const TODAY = getToday();

interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  taskDate: string;
  done: boolean;
  doneAt: string | null;
  spaceId: string | null;
  goalId: string | null;
  recurrence: unknown;
  updatedAt: string;
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerTaskTools);
});

beforeEach(async () => {
  await resetDb();
});

async function seedTask(overrides: Partial<{ title: string; priority: string; task_date: string }> = {}) {
  return expectOk<TaskRow>(
    await h.call(
      "create_task",
      { title: overrides.title ?? "Test task", priority: overrides.priority, task_date: overrides.task_date },
      ctx
    )
  );
}

describe("task tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("list_tasks", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects reads missing tasks:read", async () => {
    const res = await h.call("list_tasks", {}, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("tasks:read");
  });

  it("rejects writes missing tasks:write", async () => {
    const res = await h.call("create_task", { title: "x" }, { userId: TEST_USER_ID, scopes: ["tasks:read"] });
    expect(expectError(res)).toContain("tasks:write");
  });
});

describe("create_task + list_tasks", () => {
  it("creates a task with defaults and returns camelCase raw row", async () => {
    const created = await seedTask({ title: "Buy groceries" });
    expect(created.title).toBe("Buy groceries");
    // Defaults applied by the tool.
    expect(created.priority).toBe("B1");
    expect(created.done).toBe(false);
    expect(created.taskDate).toBe(TODAY);
    // Raw drizzle camelCase keys, not snake_case.
    expect(created).toHaveProperty("taskDate");
    expect(created).not.toHaveProperty("task_date");
    expect(created.updatedAt).toBeTruthy();
  });

  it("honors explicit priority and date", async () => {
    const created = await seedTask({ title: "Plan", priority: "A1", task_date: "2026-06-01" });
    expect(created.priority).toBe("A1");
    expect(created.taskDate).toBe("2026-06-01");
  });

  it("lists tasks for an explicit date", async () => {
    await seedTask({ title: "Past task", task_date: "2026-06-01" });
    const list = expectOk<TaskRow[]>(await h.call("list_tasks", { date: "2026-06-01" }, ctx));
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Past task");
  });

  it("orders results by priority then sort order", async () => {
    await seedTask({ title: "low", priority: "C9", task_date: "2026-06-02" });
    await seedTask({ title: "high", priority: "A1", task_date: "2026-06-02" });
    const list = expectOk<TaskRow[]>(await h.call("list_tasks", { date: "2026-06-02" }, ctx));
    expect(list.map((t) => t.title)).toEqual(["high", "low"]);
  });

  it("does not return another user's tasks", async () => {
    await h.call("create_task", { title: "Mine", task_date: "2026-06-03" }, ctx);
    const list = expectOk<TaskRow[]>(
      await h.call("list_tasks", { date: "2026-06-03" }, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(list).toHaveLength(0);
  });
});

describe("list_tasks — today rollover behavior", () => {
  it("surfaces incomplete past tasks on today's list", async () => {
    // An incomplete task dated before today.
    await seedTask({ title: "Overdue", task_date: "2026-06-01" });
    await seedTask({ title: "Today", task_date: TODAY });

    const today = expectOk<TaskRow[]>(await h.call("list_tasks", {}, ctx));
    const titles = today.map((t) => t.title);
    expect(titles).toContain("Overdue");
    expect(titles).toContain("Today");
  });

  it("does not surface completed past tasks on today's list", async () => {
    const past = await seedTask({ title: "Done past", task_date: "2026-06-01" });
    expectOk(await h.call("complete_task", { task_id: past.id }, ctx));

    const today = expectOk<TaskRow[]>(await h.call("list_tasks", {}, ctx));
    expect(today.map((t) => t.title)).not.toContain("Done past");
  });
});

describe("update_task — legacy (last-write-wins)", () => {
  it("updates fields without expected_updated_at", async () => {
    const task = await seedTask({ title: "Original" });
    const updated = expectOk<TaskRow>(
      await h.call("update_task", { task_id: task.id, title: "Renamed", priority: "A2", notes: "hi" }, ctx)
    );
    expect(updated.title).toBe("Renamed");
    expect(updated.priority).toBe("A2");
    expect(updated.notes).toBe("hi");
  });

  it("marks done via update_task and sets doneAt", async () => {
    const task = await seedTask();
    const updated = expectOk<TaskRow>(await h.call("update_task", { task_id: task.id, done: true }, ctx));
    expect(updated.done).toBe(true);
    expect(updated.doneAt).toBeTruthy();
  });

  it("returns not found for an unknown task", async () => {
    const res = await h.call("update_task", { task_id: OTHER_USER_ID, title: "x" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not update another user's task", async () => {
    const task = await seedTask();
    const res = await h.call(
      "update_task",
      { task_id: task.id, title: "Hacked" },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("update_task — optimistic concurrency", () => {
  it("succeeds when expected_updated_at matches the current row", async () => {
    const task = await seedTask({ title: "Concurrent" });
    const updated = expectOk<TaskRow>(
      await h.call(
        "update_task",
        { task_id: task.id, expected_updated_at: task.updatedAt, title: "Updated" },
        ctx
      )
    );
    expect(updated.title).toBe("Updated");
  });

  it("returns a conflict when expected_updated_at is stale", async () => {
    const task = await seedTask();
    const staleToken = new Date(Date.now() - 60_000).toISOString();
    const res = await h.call(
      "update_task",
      { task_id: task.id, expected_updated_at: staleToken, title: "Loser" },
      ctx
    );
    expect(res.isError).toBe(true);
    const text = expectError(res);
    expect(text).toContain("conflict");
    // Conflict payload carries the current row.
    const parsed = JSON.parse(text) as { error: string; current: TaskRow };
    expect(parsed.error).toBe("conflict");
    expect(parsed.current.id).toBe(task.id);
  });

  it("returns not found (not conflict) for an unknown id with a token", async () => {
    const res = await h.call(
      "update_task",
      { task_id: OTHER_USER_ID, expected_updated_at: new Date().toISOString(), title: "x" },
      ctx
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("complete_task", () => {
  it("marks a task done and sets doneAt", async () => {
    const task = await seedTask();
    const done = expectOk<TaskRow>(await h.call("complete_task", { task_id: task.id }, ctx));
    expect(done.done).toBe(true);
    expect(done.doneAt).toBeTruthy();
  });

  it("returns not found for an unknown task", async () => {
    const res = await h.call("complete_task", { task_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not complete another user's task", async () => {
    const task = await seedTask();
    const res = await h.call("complete_task", { task_id: task.id }, { userId: OTHER_USER_ID, scopes: SCOPES });
    expect(expectError(res)).toContain("not found");
  });

  it("spawns the next occurrence when the task is recurring", async () => {
    // create_task does not accept recurrence, so seed a recurring task directly.
    const { db } = await getTestDb();
    const [recurring] = await db
      .insert(tasks)
      .values({
        userId: TEST_USER_ID,
        title: "Daily standup",
        taskDate: "2026-06-05",
        recurrence: { type: "daily" },
        done: false,
      })
      .returning();

    expectOk<TaskRow>(await h.call("complete_task", { task_id: recurring.id }, ctx));

    // The next occurrence (2026-06-06) should now exist and be incomplete.
    const next = expectOk<TaskRow[]>(await h.call("list_tasks", { date: "2026-06-06" }, ctx));
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("Daily standup");
    expect(next[0].done).toBe(false);
    expect(next[0].recurrence).toEqual({ type: "daily" });
  });
});

describe("recurrence — idempotency and field preservation", () => {
  async function seedRecurring(overrides: Partial<typeof tasks.$inferInsert> = {}) {
    const { db } = await getTestDb();
    const [row] = await db
      .insert(tasks)
      .values({
        userId: TEST_USER_ID,
        title: "Daily standup",
        taskDate: "2026-06-05",
        recurrence: { type: "daily" },
        done: false,
        ...overrides,
      })
      .returning();
    return row;
  }

  async function tasksOn(date: string) {
    return expectOk<TaskRow[]>(await h.call("list_tasks", { date }, ctx));
  }

  it("completing a recurring task twice spawns only one next occurrence", async () => {
    const recurring = await seedRecurring();
    expectOk(await h.call("complete_task", { task_id: recurring.id }, ctx));
    expectOk(await h.call("complete_task", { task_id: recurring.id }, ctx));

    expect(await tasksOn("2026-06-06")).toHaveLength(1);
  });

  it("toggling done off and back on does not stack occurrences", async () => {
    const recurring = await seedRecurring();
    expectOk(await h.call("complete_task", { task_id: recurring.id }, ctx));
    expectOk(await h.call("update_task", { task_id: recurring.id, done: false }, ctx));
    expectOk(await h.call("update_task", { task_id: recurring.id, done: true }, ctx));

    expect(await tasksOn("2026-06-06")).toHaveLength(1);
  });

  it("update_task(done: true) spawns the next occurrence like complete_task", async () => {
    const recurring = await seedRecurring();
    expectOk(await h.call("update_task", { task_id: recurring.id, done: true }, ctx));

    const next = await tasksOn("2026-06-06");
    expect(next).toHaveLength(1);
    expect(next[0].recurrence).toEqual({ type: "daily" });
  });

  it("versioned complete_task is also idempotent", async () => {
    const recurring = await seedRecurring();
    const first = expectOk<TaskRow>(
      await h.call("complete_task", { task_id: recurring.id, expected_updated_at: recurring.updatedAt.toISOString() }, ctx)
    );
    // Retry with a fresh token on the already-done task.
    expectOk(await h.call("complete_task", { task_id: recurring.id, expected_updated_at: first.updatedAt }, ctx));

    expect(await tasksOn("2026-06-06")).toHaveLength(1);
  });

  it("preserves the goal link on the spawned occurrence", async () => {
    const { db } = await getTestDb();
    const [goal] = await db
      .insert(goals)
      .values({ userId: TEST_USER_ID, title: "Ship project" })
      .returning();
    const recurring = await seedRecurring({ goalId: goal.id, spaceId: null, notes: "with goal" });

    expectOk(await h.call("complete_task", { task_id: recurring.id }, ctx));

    const next = await tasksOn("2026-06-06");
    expect(next).toHaveLength(1);
    expect(next[0].goalId).toBe(goal.id);
    expect(next[0].notes).toBe("with goal");
  });

  it("does not spawn a same-day duplicate for an unknown recurrence type", async () => {
    const recurring = await seedRecurring({ recurrence: { type: "fortnightly" } });
    expectOk(await h.call("complete_task", { task_id: recurring.id }, ctx));

    // Only the original (now done) task exists on its date; no copy was created.
    const sameDay = await tasksOn("2026-06-05");
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0].done).toBe(true);
  });

  it("completing a non-recurring task never spawns anything", async () => {
    const task = await seedTask({ task_date: "2026-06-05" });
    expectOk(await h.call("complete_task", { task_id: task.id }, ctx));
    expect(await tasksOn("2026-06-06")).toHaveLength(0);
  });
});

describe("delete_task", () => {
  it("deletes a task", async () => {
    const task = await seedTask({ task_date: "2026-06-04" });
    const res = expectOk<{ success: boolean }>(await h.call("delete_task", { task_id: task.id }, ctx));
    expect(res.success).toBe(true);

    const list = expectOk<TaskRow[]>(await h.call("list_tasks", { date: "2026-06-04" }, ctx));
    expect(list).toHaveLength(0);
  });

  it("returns not found for an unknown task id", async () => {
    const res = await h.call("delete_task", { task_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not delete another user's task and reports not found", async () => {
    const task = await seedTask({ task_date: "2026-06-04" });
    // delete scopes by userId, so OTHER_USER_ID's delete matches nothing.
    const res = await h.call("delete_task", { task_id: task.id }, { userId: OTHER_USER_ID, scopes: SCOPES });
    expect(expectError(res)).toContain("not found");

    const list = expectOk<TaskRow[]>(await h.call("list_tasks", { date: "2026-06-04" }, ctx));
    expect(list).toHaveLength(1);
  });
});

describe("list_tasks — date validation", () => {
  it("rejects a malformed date string via zod", async () => {
    await expect(h.call("list_tasks", { date: "junk" }, ctx)).rejects.toThrow();
  });

  it("rejects a partial date string", async () => {
    await expect(h.call("list_tasks", { date: "2026-06" }, ctx)).rejects.toThrow();
  });
});
