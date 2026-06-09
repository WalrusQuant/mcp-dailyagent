import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerHabitTools } from "@/lib/mcp/tools/habits";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["habits:read", "habits:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };

const TODAY = new Date().toISOString().split("T")[0];

interface HabitRow {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  targetDays: number[] | null;
  color: string;
  archived: boolean;
  updatedAt: string;
}

interface HabitStats {
  id: string;
  name: string;
  color: string | null;
  streak: number;
  completionRate: number;
  recentLogs: string[];
}

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerHabitTools);
});

beforeEach(async () => {
  await resetDb();
});

async function seedHabit(overrides: Partial<{ name: string }> = {}) {
  return expectOk<HabitRow>(await h.call("create_habit", { name: overrides.name ?? "Meditate" }, ctx));
}

describe("habit tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("list_habits", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects reads missing habits:read", async () => {
    const res = await h.call("list_habits", {}, { userId: TEST_USER_ID, scopes: [] });
    expect(expectError(res)).toContain("habits:read");
  });

  it("rejects writes missing habits:write", async () => {
    const res = await h.call("create_habit", { name: "x" }, { userId: TEST_USER_ID, scopes: ["habits:read"] });
    expect(expectError(res)).toContain("habits:write");
  });
});

describe("create_habit + list_habits", () => {
  it("creates a habit with defaults and returns camelCase raw row", async () => {
    const created = await seedHabit({ name: "Read" });
    expect(created.name).toBe("Read");
    expect(created.frequency).toBe("daily");
    expect(created.color).toBe("#d4a574");
    expect(created.archived).toBe(false);
    expect(created.targetDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Raw drizzle camelCase keys.
    expect(created).toHaveProperty("targetDays");
    expect(created).not.toHaveProperty("target_days");
  });

  it("honors explicit fields on create", async () => {
    const created = expectOk<HabitRow>(
      await h.call(
        "create_habit",
        {
          name: "Gym",
          description: "Lift weights",
          frequency: "weekly",
          target_days: [1, 3, 5],
          color: "#abcdef",
        },
        ctx
      )
    );
    expect(created.description).toBe("Lift weights");
    expect(created.frequency).toBe("weekly");
    expect(created.targetDays).toEqual([1, 3, 5]);
    expect(created.color).toBe("#abcdef");
  });

  it("lists created habits", async () => {
    await seedHabit({ name: "A" });
    await seedHabit({ name: "B" });
    const list = expectOk<HabitRow[]>(await h.call("list_habits", {}, ctx));
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.name).sort()).toEqual(["A", "B"]);
  });

  it("does not return another user's habits", async () => {
    await seedHabit();
    const list = expectOk<HabitRow[]>(
      await h.call("list_habits", {}, { userId: OTHER_USER_ID, scopes: SCOPES })
    );
    expect(list).toHaveLength(0);
  });
});

describe("list_habits — include_archived filter", () => {
  it("hides archived habits by default and shows them with include_archived", async () => {
    const habit = await seedHabit({ name: "Archivable" });
    expectOk(await h.call("update_habit", { habit_id: habit.id, archived: true }, ctx));

    const hidden = expectOk<HabitRow[]>(await h.call("list_habits", {}, ctx));
    expect(hidden).toHaveLength(0);

    const shown = expectOk<HabitRow[]>(await h.call("list_habits", { include_archived: true }, ctx));
    expect(shown).toHaveLength(1);
    expect(shown[0].archived).toBe(true);
  });
});

describe("update_habit — legacy (last-write-wins)", () => {
  it("updates name/description/frequency/target_days/color", async () => {
    const habit = await seedHabit();
    const updated = expectOk<HabitRow>(
      await h.call(
        "update_habit",
        {
          habit_id: habit.id,
          name: "Mindfulness",
          description: "5 minutes",
          frequency: "weekly",
          target_days: [2, 4],
          color: "#123456",
        },
        ctx
      )
    );
    expect(updated.name).toBe("Mindfulness");
    expect(updated.description).toBe("5 minutes");
    expect(updated.frequency).toBe("weekly");
    expect(updated.targetDays).toEqual([2, 4]);
    expect(updated.color).toBe("#123456");
  });

  it("returns not found for an unknown habit", async () => {
    const res = await h.call("update_habit", { habit_id: OTHER_USER_ID, name: "x" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not update another user's habit", async () => {
    const habit = await seedHabit();
    const res = await h.call(
      "update_habit",
      { habit_id: habit.id, name: "Hacked" },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });
});

describe("update_habit — optimistic concurrency", () => {
  it("succeeds when expected_updated_at matches", async () => {
    const habit = await seedHabit({ name: "Concurrent" });
    const updated = expectOk<HabitRow>(
      await h.call(
        "update_habit",
        { habit_id: habit.id, expected_updated_at: habit.updatedAt, name: "Updated" },
        ctx
      )
    );
    expect(updated.name).toBe("Updated");
  });

  it("returns a conflict when expected_updated_at is stale", async () => {
    const habit = await seedHabit();
    const staleToken = new Date(Date.now() - 60_000).toISOString();
    const res = await h.call(
      "update_habit",
      { habit_id: habit.id, expected_updated_at: staleToken, name: "Loser" },
      ctx
    );
    expect(res.isError).toBe(true);
    const text = expectError(res);
    expect(text).toContain("conflict");
    const parsed = JSON.parse(text) as { error: string; current: HabitRow };
    expect(parsed.error).toBe("conflict");
    expect(parsed.current.id).toBe(habit.id);
  });
});

describe("toggle_habit + get_habit_stats", () => {
  it("toggles completion on then off for a date", async () => {
    const habit = await seedHabit();

    const on = expectOk<{ toggled: boolean; date: string }>(
      await h.call("toggle_habit", { habit_id: habit.id, date: TODAY }, ctx)
    );
    expect(on.toggled).toBe(true);
    expect(on.date).toBe(TODAY);

    const off = expectOk<{ toggled: boolean; date: string }>(
      await h.call("toggle_habit", { habit_id: habit.id, date: TODAY }, ctx)
    );
    expect(off.toggled).toBe(false);
  });

  it("reflects a completion in get_habit_stats", async () => {
    const habit = await seedHabit();
    expectOk(await h.call("toggle_habit", { habit_id: habit.id, date: TODAY }, ctx));

    const stats = expectOk<HabitStats>(await h.call("get_habit_stats", { habit_id: habit.id }, ctx));
    expect(stats.id).toBe(habit.id);
    expect(stats.recentLogs).toContain(TODAY);
    // Today is a target day for the default all-7 schedule, so a streak forms.
    expect(stats.streak).toBeGreaterThanOrEqual(1);
    expect(stats.completionRate).toBeGreaterThan(0);
  });

  it("returns not found when toggling an unknown habit", async () => {
    const res = await h.call("toggle_habit", { habit_id: OTHER_USER_ID, date: TODAY }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not toggle another user's habit", async () => {
    const habit = await seedHabit();
    const res = await h.call(
      "toggle_habit",
      { habit_id: habit.id, date: TODAY },
      { userId: OTHER_USER_ID, scopes: SCOPES }
    );
    expect(expectError(res)).toContain("not found");
  });

  it("returns not found stats for an unknown habit", async () => {
    const res = await h.call("get_habit_stats", { habit_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });
});

describe("delete_habit", () => {
  it("deletes a habit and cascades its logs", async () => {
    const habit = await seedHabit();
    expectOk(await h.call("toggle_habit", { habit_id: habit.id, date: TODAY }, ctx));

    const res = expectOk<{ success: boolean }>(await h.call("delete_habit", { habit_id: habit.id }, ctx));
    expect(res.success).toBe(true);

    const list = expectOk<HabitRow[]>(await h.call("list_habits", { include_archived: true }, ctx));
    expect(list).toHaveLength(0);

    // The habit (and its cascaded logs) are gone, so stats now reports not found.
    const stats = await h.call("get_habit_stats", { habit_id: habit.id }, ctx);
    expect(expectError(stats)).toContain("not found");
  });

  it("returns not found for an unknown habit", async () => {
    const res = await h.call("delete_habit", { habit_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not delete another user's habit", async () => {
    const habit = await seedHabit();
    const res = await h.call("delete_habit", { habit_id: habit.id }, { userId: OTHER_USER_ID, scopes: SCOPES });
    expect(expectError(res)).toContain("not found");

    const list = expectOk<HabitRow[]>(await h.call("list_habits", {}, ctx));
    expect(list).toHaveLength(1);
  });
});
