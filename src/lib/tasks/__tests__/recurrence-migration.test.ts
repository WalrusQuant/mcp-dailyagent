import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { taskRecurrenceSeries, tasks } from "@/lib/db/schema";
import { getTestDb, resetDb, TEST_USER_ID } from "@/test/db-harness";

beforeEach(async () => {
  await resetDb();
});

describe("recurrence series migration", () => {
  it("backfills each ambiguous legacy row into its own series", async () => {
    const { client, db } = await getTestDb();
    const legacy = await db
      .insert(tasks)
      .values([
        { userId: TEST_USER_ID, title: "Same title", taskDate: "2026-08-01", recurrence: { type: "daily" } },
        { userId: TEST_USER_ID, title: "Same title", taskDate: "2026-08-02", recurrence: { type: "daily" } },
      ])
      .returning();

    await client.exec(`
      INSERT INTO task_recurrence_series (id, user_id, rule, anchor_date, created_at, updated_at)
      SELECT id, user_id, recurrence, task_date, created_at, updated_at
      FROM tasks
      WHERE recurrence IS NOT NULL AND recurrence_series_id IS NULL
      ON CONFLICT (id) DO NOTHING;
      UPDATE tasks
      SET recurrence_series_id = id, scheduled_date = task_date
      WHERE recurrence IS NOT NULL AND recurrence_series_id IS NULL;
    `);

    const backfilled = await db.select().from(tasks).where(eq(tasks.userId, TEST_USER_ID));
    expect(backfilled.map((task) => task.recurrenceSeriesId).sort()).toEqual(
      legacy.map((task) => task.id).sort()
    );
    expect(new Set(backfilled.map((task) => task.recurrenceSeriesId)).size).toBe(2);
  });

  it("supports first-class series and enforces one occurrence per scheduled date", async () => {
    const { db } = await getTestDb();
    const [series] = await db
      .insert(taskRecurrenceSeries)
      .values({ userId: TEST_USER_ID, rule: { type: "daily" }, anchorDate: "2026-08-01" })
      .returning();

    await db.insert(tasks).values({
      userId: TEST_USER_ID,
      title: "Repeat",
      taskDate: "2026-08-01",
      recurrence: { type: "daily" },
      recurrenceSeriesId: series.id,
      scheduledDate: "2026-08-01",
    });

    await expect(
      db.insert(tasks).values({
        userId: TEST_USER_ID,
        title: "Duplicate",
        taskDate: "2026-08-02",
        recurrence: { type: "daily" },
        recurrenceSeriesId: series.id,
        scheduledDate: "2026-08-01",
      })
    ).rejects.toThrow();

    const rows = await db.select().from(taskRecurrenceSeries).where(eq(taskRecurrenceSeries.id, series.id));
    expect(rows).toHaveLength(1);
  });

  it("leaves invalid legacy recurrence JSON unclassified", async () => {
    const { client, db } = await getTestDb();
    const legacy = await db
      .insert(tasks)
      .values([
        { userId: TEST_USER_ID, title: "Out of range", taskDate: "2026-08-01", recurrence: { type: "weekly", days: [0, 1] } },
        { userId: TEST_USER_ID, title: "Scalar days", taskDate: "2026-08-02", recurrence: { type: "weekly", days: "Monday" } },
        { userId: TEST_USER_ID, title: "Mixed days", taskDate: "2026-08-03", recurrence: { type: "weekly", days: [1, "two"] } },
        { userId: TEST_USER_ID, title: "Scalar rule", taskDate: "2026-08-04", recurrence: "daily" },
      ])
      .returning();

    const migration = await import("fs").then(({ readFileSync }) =>
      readFileSync(`${process.cwd()}/drizzle/0009_task_recurrence_series.sql`, "utf8")
    );
    for (const statement of migration.split("--> statement-breakpoint").slice(5, 7)) {
      await client.exec(statement.trim());
    }

    const stored = await db.select().from(tasks).where(eq(tasks.userId, TEST_USER_ID));
    expect(stored).toHaveLength(legacy.length);
    expect(stored.every((task) => task.recurrenceSeriesId === null)).toBe(true);
  });
});
