import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  getTasksForDate,
  getOverdueTasks,
  createTask,
  completeTask,
  deleteTask,
  Task,
} from "@/lib/mcp/queries/tasks";

// ---------------------------------------------------------------------------
// Mock getToday so tests are date-independent
// ---------------------------------------------------------------------------

vi.mock("@/lib/dates", () => ({
  getToday: vi.fn(() => "2026-03-23"),
}));

import { getToday } from "@/lib/dates";
const mockGetToday = vi.mocked(getToday);

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
// ---------------------------------------------------------------------------

type QueryResult<T> = { data: T; error: { message: string } | null };

interface MockBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  _resolve: (result: QueryResult<unknown>) => void;
}

function createMockSupabase(defaultResult: QueryResult<unknown> = { data: [], error: null }) {
  let resolvedResult = defaultResult;

  const builder: MockBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(resolvedResult)),
    _resolve: (r) => {
      resolvedResult = r;
    },
  };

  // Make the builder thenable so `await supabase.from(...).select(...).eq(...)` resolves
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (value: QueryResult<unknown>) => void) => resolve(resolvedResult);
      }
      return target[prop as keyof MockBuilder];
    },
  });

  // All chainable methods return the same proxy
  for (const method of ["select", "insert", "update", "delete", "eq", "or", "lt", "order"] as const) {
    builder[method].mockReturnValue(proxy);
  }
  builder.single.mockImplementation(() => Promise.resolve(resolvedResult));

  const supabase = {
    from: vi.fn().mockReturnValue(proxy),
    _builder: builder,
    /** Override what the next awaited query resolves to */
    setResult(r: QueryResult<unknown>) {
      resolvedResult = r;
      builder.single.mockImplementation(() => Promise.resolve(r));
    },
  };

  return supabase;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = "2026-03-23";

const sampleTask: Task = {
  id: "task-1",
  user_id: "user-abc",
  title: "Write tests",
  notes: null,
  priority: "A1",
  task_date: TODAY,
  space_id: null,
  goal_id: null,
  done: false,
  done_at: null,
  recurrence: null,
  sort_order: 0,
  created_at: "2026-03-23T00:00:00Z",
  updated_at: "2026-03-23T00:00:00Z",
};

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToday.mockReturnValue(TODAY);
});

// ---------------------------------------------------------------------------
// getTasksForDate
// ---------------------------------------------------------------------------

describe("getTasksForDate", () => {
  it("uses .or() filter when date is today (includes overdue)", async () => {
    const mock = createMockSupabase({ data: [sampleTask], error: null });

    await getTasksForDate(mock as unknown as SupabaseClient, "user-abc", TODAY);

    expect(mock._builder.or).toHaveBeenCalledWith(
      `task_date.eq.${TODAY},and(task_date.lt.${TODAY},done.eq.false)`
    );
  });

  it("uses .or() filter when no date is passed (defaults to today)", async () => {
    const mock = createMockSupabase({ data: [sampleTask], error: null });

    await getTasksForDate(mock as unknown as SupabaseClient, "user-abc");

    expect(mock._builder.or).toHaveBeenCalled();
  });

  it("uses .eq('task_date', ...) filter for a specific past date", async () => {
    const pastDate = "2026-03-01";
    const mock = createMockSupabase({ data: [sampleTask], error: null });

    await getTasksForDate(mock as unknown as SupabaseClient, "user-abc", pastDate);

    // Should NOT use .or() for past date
    expect(mock._builder.or).not.toHaveBeenCalled();
    // Should use eq with the task_date
    const eqCalls = mock._builder.eq.mock.calls as [string, unknown][];
    const taskDateCall = eqCalls.find(([col]) => col === "task_date");
    expect(taskDateCall).toBeDefined();
    expect(taskDateCall![1]).toBe(pastDate);
  });

  it("returns task list on success", async () => {
    const mock = createMockSupabase({ data: [sampleTask], error: null });

    const result = await getTasksForDate(mock as unknown as SupabaseClient, "user-abc", TODAY);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([sampleTask]);
  });

  it("returns error when supabase returns an error", async () => {
    const mock = createMockSupabase({ data: null as unknown as Task[], error: { message: "DB error" } });

    const result = await getTasksForDate(mock as unknown as SupabaseClient, "user-abc", TODAY);

    expect(result.data).toBeNull();
    expect(result.error).toBe("DB error");
  });
});

// ---------------------------------------------------------------------------
// getOverdueTasks
// ---------------------------------------------------------------------------

describe("getOverdueTasks", () => {
  it("queries tasks with task_date less than today and done=false", async () => {
    const mock = createMockSupabase({ data: [], error: null });

    await getOverdueTasks(mock as unknown as SupabaseClient, "user-abc");

    expect(mock._builder.lt).toHaveBeenCalledWith("task_date", TODAY);
    const eqCalls = mock._builder.eq.mock.calls as [string, unknown][];
    const doneCall = eqCalls.find(([col]) => col === "done");
    expect(doneCall).toBeDefined();
    expect(doneCall![1]).toBe(false);
  });

  it("returns error when supabase returns an error", async () => {
    const mock = createMockSupabase({
      data: null as unknown as Task[],
      error: { message: "overdue error" },
    });

    const result = await getOverdueTasks(mock as unknown as SupabaseClient, "user-abc");

    expect(result.data).toBeNull();
    expect(result.error).toBe("overdue error");
  });
});

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

describe("createTask", () => {
  it("inserts with correct fields and defaults priority to B1", async () => {
    const mock = createMockSupabase();
    mock.setResult({ data: { ...sampleTask, priority: "B1" }, error: null });

    await createTask(mock as unknown as SupabaseClient, "user-abc", { title: "New task" });

    const insertCall = mock._builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.user_id).toBe("user-abc");
    expect(insertCall.title).toBe("New task");
    expect(insertCall.priority).toBe("B1");
    expect(insertCall.task_date).toBe(TODAY);
    expect(insertCall.notes).toBeNull();
    expect(insertCall.space_id).toBeNull();
    expect(insertCall.goal_id).toBeNull();
  });

  it("uses provided priority when given", async () => {
    const mock = createMockSupabase();
    mock.setResult({ data: { ...sampleTask, priority: "A1" }, error: null });

    await createTask(mock as unknown as SupabaseClient, "user-abc", {
      title: "Urgent task",
      priority: "A1",
    });

    const insertCall = mock._builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.priority).toBe("A1");
  });

  it("uses provided task_date when given", async () => {
    const mock = createMockSupabase();
    mock.setResult({ data: sampleTask, error: null });

    await createTask(mock as unknown as SupabaseClient, "user-abc", {
      title: "Future task",
      task_date: "2026-04-01",
    });

    const insertCall = mock._builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.task_date).toBe("2026-04-01");
  });

  it("returns error when supabase returns an error", async () => {
    const mock = createMockSupabase();
    mock.setResult({ data: null, error: { message: "insert failed" } });

    const result = await createTask(mock as unknown as SupabaseClient, "user-abc", {
      title: "Bad task",
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("insert failed");
  });
});

// ---------------------------------------------------------------------------
// completeTask
// ---------------------------------------------------------------------------

describe("completeTask", () => {
  it("sets done=true and done_at to an ISO string", async () => {
    const completedTask = { ...sampleTask, done: true, done_at: new Date().toISOString() };
    const mock = createMockSupabase();
    mock.setResult({ data: completedTask, error: null });

    await completeTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    const updateCall = mock._builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall.done).toBe(true);
    expect(typeof updateCall.done_at).toBe("string");
    // Verify it's a valid ISO 8601 date string
    expect(() => new Date(updateCall.done_at as string).toISOString()).not.toThrow();
  });

  it("filters by task id and user_id", async () => {
    const completedTask = { ...sampleTask, done: true };
    const mock = createMockSupabase();
    mock.setResult({ data: completedTask, error: null });

    await completeTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    const eqCalls = mock._builder.eq.mock.calls as [string, unknown][];
    const idCall = eqCalls.find(([col]) => col === "id");
    const userCall = eqCalls.find(([col]) => col === "user_id");
    expect(idCall![1]).toBe("task-1");
    expect(userCall![1]).toBe("user-abc");
  });

  it("returns error when supabase returns an error", async () => {
    const mock = createMockSupabase();
    mock.setResult({ data: null, error: { message: "update failed" } });

    const result = await completeTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("update failed");
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

describe("deleteTask", () => {
  it("deletes with correct user_id and task_id filters", async () => {
    const mock = createMockSupabase({ data: null, error: null });

    await deleteTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    expect(mock.from).toHaveBeenCalledWith("tasks");
    expect(mock._builder.delete).toHaveBeenCalled();
    const eqCalls = mock._builder.eq.mock.calls as [string, unknown][];
    const idCall = eqCalls.find(([col]) => col === "id");
    const userCall = eqCalls.find(([col]) => col === "user_id");
    expect(idCall![1]).toBe("task-1");
    expect(userCall![1]).toBe("user-abc");
  });

  it("returns { success: true } on success", async () => {
    const mock = createMockSupabase({ data: null, error: null });

    const result = await deleteTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ success: true });
  });

  it("returns error when supabase returns an error", async () => {
    const mock = createMockSupabase({ data: null, error: { message: "delete failed" } });

    const result = await deleteTask(mock as unknown as SupabaseClient, "user-abc", "task-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("delete failed");
  });
});
