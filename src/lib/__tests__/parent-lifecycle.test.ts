import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { eq } from "drizzle-orm";
import { goals, habits, spaces, tasks } from "@/lib/db/schema";
import { transitionGoal, transitionSpace } from "@/lib/parent-lifecycle";
import { completeTaskAggregate, createTaskAggregate, TaskMutationError } from "@/lib/tasks/mutations";
import { getTestDb, resetDb, TEST_USER_ID } from "@/test/db-harness";

beforeEach(async () => resetDb());

describe("parent lifecycle", () => {
  it("freezes completed goals at 100 while retaining linked work and reporting active counts", async () => {
    const { db } = await getTestDb();
    const [goal] = await db.insert(goals).values({ userId: TEST_USER_ID, title: "Launch", progressMode: "auto", progress: 30 }).returning();
    await db.insert(tasks).values({ userId: TEST_USER_ID, title: "Ship", goalId: goal.id });
    await db.insert(habits).values({ userId: TEST_USER_ID, name: "Review", goalId: goal.id });

    const result = await transitionGoal(TEST_USER_ID, goal.id, "completed");
    expect(result.row).toMatchObject({ status: "completed", progress: 100 });
    expect(result.active_linked).toEqual({ tasks: 1, habits: 1 });
    expect((await db.select().from(tasks).where(eq(tasks.goalId, goal.id)))).toHaveLength(1);
    expect((await db.select().from(habits).where(eq(habits.goalId, goal.id)))).toHaveLength(1);
  });

  it("rejects new task assignments to terminal parents but allows paused spaces", async () => {
    const { db } = await getTestDb();
    const [goal] = await db.insert(goals).values({ userId: TEST_USER_ID, title: "Done", status: "completed" }).returning();
    const [closed] = await db.insert(spaces).values({ userId: TEST_USER_ID, name: "Closed", status: "completed" }).returning();
    const [paused] = await db.insert(spaces).values({ userId: TEST_USER_ID, name: "Paused", status: "paused" }).returning();

    await expect(createTaskAggregate(TEST_USER_ID, { title: "No", taskDate: "2026-08-01", goalId: goal.id })).rejects.toBeInstanceOf(TaskMutationError);
    await expect(createTaskAggregate(TEST_USER_ID, { title: "No", taskDate: "2026-08-01", spaceId: closed.id })).rejects.toBeInstanceOf(TaskMutationError);
    await expect(createTaskAggregate(TEST_USER_ID, { title: "Yes", taskDate: "2026-08-01", spaceId: paused.id })).resolves.toBeDefined();
  });

  it("keeps historical recurrence links but unlinks successors from parents closed before completion", async () => {
    const { db } = await getTestDb();
    const [space] = await db.insert(spaces).values({ userId: TEST_USER_ID, name: "Project" }).returning();
    const created = await createTaskAggregate(TEST_USER_ID, {
      title: "Daily",
      taskDate: "2026-08-01",
      recurrence: { type: "daily" },
      spaceId: space.id,
    });
    await transitionSpace(TEST_USER_ID, space.id, "completed");
    await completeTaskAggregate(TEST_USER_ID, created.task.id);

    const rows = await db.select().from(tasks).where(eq(tasks.recurrenceSeriesId, created.task.recurrenceSeriesId!));
    expect(rows.find((row) => row.id === created.task.id)?.spaceId).toBe(space.id);
    expect(rows.find((row) => row.id !== created.task.id)?.spaceId).toBeNull();
  });

  it("applies lifecycle and companion edits atomically using the new progress mode", async () => {
    const { db } = await getTestDb();
    const [goal] = await db.insert(goals).values({
      userId: TEST_USER_ID,
      title: "Original",
      status: "completed",
      progress: 100,
      progressMode: "auto",
    }).returning();

    const result = await transitionGoal(TEST_USER_ID, goal.id, "active", undefined, {
      title: "Reopened",
      progressMode: "manual",
      progress: 42,
    });

    expect(result.row).toMatchObject({
      title: "Reopened",
      status: "active",
      progressMode: "manual",
      progress: 42,
    });
  });

  it("does not apply companion edits when lifecycle concurrency fails", async () => {
    const { db } = await getTestDb();
    const [space] = await db.insert(spaces).values({ userId: TEST_USER_ID, name: "Original" }).returning();
    await db.update(spaces).set({ name: "Concurrent", updatedAt: new Date(space.updatedAt.getTime() + 1000) }).where(eq(spaces.id, space.id));

    await expect(
      transitionSpace(TEST_USER_ID, space.id, "completed", space.updatedAt.toISOString(), { name: "Lost" })
    ).rejects.toMatchObject({ code: "conflict" });
    const [stored] = await db.select().from(spaces).where(eq(spaces.id, space.id));
    expect(stored).toMatchObject({ name: "Concurrent", status: "active" });
  });
});
