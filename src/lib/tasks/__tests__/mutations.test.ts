import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { eq, sql } from "drizzle-orm";
import { tasks } from "@/lib/db/schema";
import { getTestDb, OTHER_USER_ID, resetDb, TEST_USER_ID } from "@/test/db-harness";
import {
  completeTaskAggregate,
  reorderTasksAggregate,
  TaskMutationError,
  updateTaskAggregate,
} from "@/lib/tasks/mutations";

beforeEach(async () => {
  await resetDb();
});

describe("task aggregate mutations", () => {
  it("rejects a stale tag-only update and preserves the task version", async () => {
    const { db } = await getTestDb();
    const [task] = await db.insert(tasks).values({ userId: TEST_USER_ID, title: "Current" }).returning();

    await expect(
      updateTaskAggregate(TEST_USER_ID, task.id, {
        patch: {},
        tagIds: [],
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
      })
    ).rejects.toMatchObject({ code: "conflict" } satisfies Partial<TaskMutationError>);

    const [stored] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(stored.updatedAt).toEqual(task.updatedAt);
  });

  it("completes a never-edited task when updated_at has microsecond precision", async () => {
    // defaultNow() stores µs; the API serializes toISOString() (ms). Exact
    // equality on updated_at rejects the match and blocks toggle-complete.
    const { db } = await getTestDb();
    const [task] = await db
      .insert(tasks)
      .values({ userId: TEST_USER_ID, title: "Publish: FIP Is Not ERA", taskDate: "2026-08-08" })
      .returning();

    await db.execute(sql`
      UPDATE tasks
      SET updated_at = '2026-08-02 20:31:13.077456+00',
          created_at = '2026-08-02 20:31:13.077456+00'
      WHERE id = ${task.id}
    `);

    const [reloaded] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    const clientToken = reloaded.updatedAt.toISOString();
    expect(clientToken).toBe("2026-08-02T20:31:13.077Z");

    const result = await completeTaskAggregate(TEST_USER_ID, task.id, clientToken);
    expect(result.task.done).toBe(true);
    expect(result.task.doneAt).toBeInstanceOf(Date);
  });

  it("prevalidates reorder ownership and leaves every sort order unchanged", async () => {
    const { db } = await getTestDb();
    const [mine] = await db
      .insert(tasks)
      .values({ userId: TEST_USER_ID, title: "Mine", sortOrder: 1 })
      .returning();
    const [foreign] = await db
      .insert(tasks)
      .values({ userId: OTHER_USER_ID, title: "Foreign", sortOrder: 2 })
      .returning();

    await expect(
      reorderTasksAggregate(TEST_USER_ID, [
        { id: mine.id, sortOrder: 10 },
        { id: foreign.id, sortOrder: 20 },
      ])
    ).rejects.toMatchObject({ code: "relationship_not_found" } satisfies Partial<TaskMutationError>);

    const [storedMine] = await db.select().from(tasks).where(eq(tasks.id, mine.id));
    const [storedForeign] = await db.select().from(tasks).where(eq(tasks.id, foreign.id));
    expect(storedMine.sortOrder).toBe(1);
    expect(storedForeign.sortOrder).toBe(2);
  });
});
