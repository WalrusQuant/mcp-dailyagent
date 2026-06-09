import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { registerWorkoutTools } from "@/lib/mcp/tools/workouts";
import { createToolHarness, expectOk, expectError } from "@/test/mcp-harness";
import { resetDb, TEST_USER_ID, OTHER_USER_ID } from "@/test/db-harness";

const SCOPES = ["workouts:read", "workouts:write"];
const ctx = { userId: TEST_USER_ID, scopes: SCOPES };

let h: ReturnType<typeof createToolHarness>;

beforeAll(async () => {
  h = createToolHarness(registerWorkoutTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("workout tools — auth & scope", () => {
  it("rejects unauthenticated calls", async () => {
    const res = await h.call("list_workout_logs", {}, { scopes: SCOPES });
    expect(expectError(res)).toContain("Not authenticated");
  });

  it("rejects calls missing the required scope", async () => {
    const res = await h.call("log_workout", { name: "x", log_date: "2026-06-09" }, { userId: TEST_USER_ID });
    expect(expectError(res)).toContain("workouts:write");
  });
});

describe("create_workout_template", () => {
  it("creates a template with exercises and lists it", async () => {
    const created = expectOk<{ id: string; name: string; workout_exercises: unknown[] }>(
      await h.call(
        "create_workout_template",
        {
          name: "Push Day",
          description: "Chest + triceps",
          exercises: JSON.stringify([
            { name: "Bench Press", type: "strength", default_sets: 3, default_reps: 8, default_weight: 80 },
            { name: "Plank", type: "timed", default_duration_seconds: 60 },
          ]),
        },
        ctx
      )
    );
    expect(created.name).toBe("Push Day");
    expect(created.workout_exercises).toHaveLength(2);

    const list = expectOk<{ id: string; workout_exercises: unknown[] }[]>(
      await h.call("list_workout_templates", {}, ctx)
    );
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].workout_exercises).toHaveLength(2);
  });

  it("creates a template with no exercises", async () => {
    const created = expectOk<{ workout_exercises: unknown[] }>(
      await h.call("create_workout_template", { name: "Empty" }, ctx)
    );
    expect(created.workout_exercises).toHaveLength(0);
  });

  it("rejects malformed exercises JSON", async () => {
    const res = await h.call("create_workout_template", { name: "Bad", exercises: "{not json" }, ctx);
    expect(expectError(res)).toContain("Invalid exercises JSON");
  });

  it("rejects an exercise entry missing a name", async () => {
    const res = await h.call(
      "create_workout_template",
      { name: "Bad", exercises: JSON.stringify([{ type: "strength" }]) },
      ctx
    );
    expect(expectError(res)).toContain("Invalid exercises payload");
  });
});

describe("log_workout + list_workout_logs", () => {
  it("logs a workout with exercises and returns it in the list", async () => {
    expectOk(
      await h.call(
        "log_workout",
        {
          name: "Morning Lift",
          log_date: "2026-06-09",
          duration_minutes: 45,
          exercises: JSON.stringify([{ name: "Squat", sets: 3, reps: 5, weight: 100 }]),
        },
        ctx
      )
    );

    const logs = expectOk<{ name: string; workout_log_exercises: { sets: unknown[] }[] }[]>(
      await h.call("list_workout_logs", { date: "2026-06-09" }, ctx)
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].name).toBe("Morning Lift");
    expect(logs[0].workout_log_exercises[0].sets).toHaveLength(3);
  });
});

describe("update_workout_log", () => {
  async function seedLog() {
    const log = expectOk<{ id: string }>(
      await h.call(
        "log_workout",
        {
          name: "Original",
          log_date: "2026-06-01",
          exercises: JSON.stringify([{ name: "Curl", sets: 2, reps: 10 }]),
        },
        ctx
      )
    );
    return log.id;
  }

  it("updates scalar fields without touching exercises when omitted", async () => {
    const id = await seedLog();
    const updated = expectOk<{
      name: string;
      durationMinutes: number;
      workout_log_exercises: unknown[];
    }>(await h.call("update_workout_log", { log_id: id, name: "Renamed", duration_minutes: 30 }, ctx));

    expect(updated.name).toBe("Renamed");
    // MCP tools return raw drizzle rows (camelCase), unlike the snake_case dashboard API.
    expect(updated.durationMinutes).toBe(30);
    // Exercises untouched because the field was omitted.
    expect(updated.workout_log_exercises).toHaveLength(1);
  });

  it("replaces the exercise list when exercises is provided", async () => {
    const id = await seedLog();
    const updated = expectOk<{ workout_log_exercises: { exerciseName: string }[] }>(
      await h.call(
        "update_workout_log",
        { log_id: id, exercises: JSON.stringify([{ name: "Deadlift", sets: 1, reps: 5 }]) },
        ctx
      )
    );
    expect(updated.workout_log_exercises).toHaveLength(1);
    expect(updated.workout_log_exercises[0].exerciseName).toBe("Deadlift");
  });

  it("clears exercises when given an empty array", async () => {
    const id = await seedLog();
    const updated = expectOk<{ workout_log_exercises: unknown[] }>(
      await h.call("update_workout_log", { log_id: id, exercises: "[]" }, ctx)
    );
    expect(updated.workout_log_exercises).toHaveLength(0);
  });

  it("returns not found for an unknown log id", async () => {
    const res = await h.call("update_workout_log", { log_id: OTHER_USER_ID, name: "x" }, ctx);
    expect(expectError(res)).toContain("not found");
  });

  it("does not update another user's log", async () => {
    const id = await seedLog();
    const res = await h.call("update_workout_log", { log_id: id, name: "Hacked" }, {
      userId: OTHER_USER_ID,
      scopes: SCOPES,
    });
    expect(expectError(res)).toContain("not found");
  });
});

describe("delete_workout_log", () => {
  it("deletes an existing log", async () => {
    const log = expectOk<{ id: string }>(
      await h.call("log_workout", { name: "Temp", log_date: "2026-06-02" }, ctx)
    );
    const res = expectOk<{ success: boolean }>(await h.call("delete_workout_log", { log_id: log.id }, ctx));
    expect(res.success).toBe(true);

    const logs = expectOk<unknown[]>(await h.call("list_workout_logs", { date: "2026-06-02" }, ctx));
    expect(logs).toHaveLength(0);
  });

  it("returns not found for an unknown log", async () => {
    const res = await h.call("delete_workout_log", { log_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });
});

describe("delete_workout_template", () => {
  it("deletes an existing template", async () => {
    const tpl = expectOk<{ id: string }>(
      await h.call("create_workout_template", { name: "Throwaway" }, ctx)
    );
    const res = expectOk<{ success: boolean }>(
      await h.call("delete_workout_template", { template_id: tpl.id }, ctx)
    );
    expect(res.success).toBe(true);

    const list = expectOk<unknown[]>(await h.call("list_workout_templates", {}, ctx));
    expect(list).toHaveLength(0);
  });

  it("returns not found for an unknown template", async () => {
    const res = await h.call("delete_workout_template", { template_id: OTHER_USER_ID }, ctx);
    expect(expectError(res)).toContain("not found");
  });
});
