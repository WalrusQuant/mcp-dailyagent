import { beforeEach, describe, expect, it } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { asc, eq } from "drizzle-orm";
import { taskRecurrenceSeries, tasks } from "@/lib/db/schema";
import {
  completeTaskAggregate,
  createTaskAggregate,
  updateTaskAggregate,
} from "@/lib/tasks/mutations";
import { getTestDb, resetDb, TEST_USER_ID } from "@/test/db-harness";
import { vi } from "vitest";

beforeEach(async () => {
  await resetDb();
});

async function dailyTask(date = "2026-08-01") {
  return createTaskAggregate(TEST_USER_ID, {
    title: "Daily task",
    taskDate: date,
    recurrence: { type: "daily" },
  });
}

describe("recurring task completion", () => {
  it("is idempotent under concurrent completion", async () => {
    const { db } = await getTestDb();
    const created = await dailyTask();

    await Promise.all([
      completeTaskAggregate(TEST_USER_ID, created.task.id),
      completeTaskAggregate(TEST_USER_ID, created.task.id),
    ]);

    const occurrences = await db
      .select()
      .from(tasks)
      .where(eq(tasks.recurrenceSeriesId, created.task.recurrenceSeriesId!))
      .orderBy(asc(tasks.scheduledDate));
    expect(occurrences.map((task) => task.scheduledDate)).toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("does not duplicate a successor after reopen and re-complete", async () => {
    const { db } = await getTestDb();
    const created = await dailyTask();
    await completeTaskAggregate(TEST_USER_ID, created.task.id);
    await updateTaskAggregate(TEST_USER_ID, created.task.id, {
      patch: { done: false, doneAt: null },
    });
    await completeTaskAggregate(TEST_USER_ID, created.task.id);

    const occurrences = await db
      .select()
      .from(tasks)
      .where(eq(tasks.recurrenceSeriesId, created.task.recurrenceSeriesId!));
    expect(occurrences).toHaveLength(2);
  });

  it("rolls back completion when successor insertion fails", async () => {
    const { client, db } = await getTestDb();
    const created = await dailyTask();
    await client.exec(`
      CREATE FUNCTION fail_recurrence_successor() RETURNS trigger AS $$
      BEGIN
        IF NEW.recurrence_series_id IS NOT NULL AND NEW.id <> '${created.task.id}'::uuid THEN
          RAISE EXCEPTION 'injected successor failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_recurrence_successor_trigger
      BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION fail_recurrence_successor();
    `);

    await expect(completeTaskAggregate(TEST_USER_ID, created.task.id)).rejects.toThrow();
    const [stored] = await db.select().from(tasks).where(eq(tasks.id, created.task.id));
    expect(stored.done).toBe(false);
    expect(stored.doneAt).toBeNull();

    await client.exec(`
      DROP TRIGGER fail_recurrence_successor_trigger ON tasks;
      DROP FUNCTION fail_recurrence_successor();
    `);
  });

  it("uses scheduled cadence after the displayed task date rolls forward", async () => {
    const { db } = await getTestDb();
    const created = await createTaskAggregate(TEST_USER_ID, {
      title: "Monthly close",
      taskDate: "2026-01-31",
      recurrence: { type: "monthly" },
    });
    await db.update(tasks).set({ taskDate: "2026-02-03" }).where(eq(tasks.id, created.task.id));

    await completeTaskAggregate(TEST_USER_ID, created.task.id);
    const occurrences = await db
      .select()
      .from(tasks)
      .where(eq(tasks.recurrenceSeriesId, created.task.recurrenceSeriesId!))
      .orderBy(asc(tasks.scheduledDate));
    expect(occurrences.map((task) => [task.taskDate, task.scheduledDate])).toEqual([
      ["2026-02-03", "2026-01-31"],
      ["2026-02-28", "2026-02-28"],
    ]);
  });
});

describe("recurrence editing scope", () => {
  it("splits the series so historical occurrences retain the old rule", async () => {
    const { db } = await getTestDb();
    const created = await dailyTask();
    await completeTaskAggregate(TEST_USER_ID, created.task.id);
    const [second] = await db.select().from(tasks).where(eq(tasks.scheduledDate, "2026-08-02"));
    await completeTaskAggregate(TEST_USER_ID, second.id);

    await updateTaskAggregate(TEST_USER_ID, second.id, {
      patch: { recurrence: { type: "weekly" } },
      recurrenceScope: "future",
    });

    const [oldSeries] = await db
      .select()
      .from(taskRecurrenceSeries)
      .where(eq(taskRecurrenceSeries.id, created.task.recurrenceSeriesId!));
    const [historical] = await db.select().from(tasks).where(eq(tasks.id, created.task.id));
    const [edited] = await db.select().from(tasks).where(eq(tasks.id, second.id));
    const occurrences = await db.select().from(tasks).orderBy(asc(tasks.scheduledDate));

    expect(oldSeries.rule).toEqual({ type: "daily" });
    expect(oldSeries.endsBefore).toBe("2026-08-02");
    expect(historical.recurrenceSeriesId).toBe(oldSeries.id);
    expect(edited.recurrenceSeriesId).not.toBe(oldSeries.id);
    expect(occurrences.map((task) => task.scheduledDate)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-09",
    ]);

    // Re-completing history cannot cross the effective-date boundary.
    await updateTaskAggregate(TEST_USER_ID, historical.id, { patch: { done: false, doneAt: null } });
    await completeTaskAggregate(TEST_USER_ID, historical.id);
    expect(await db.select().from(tasks)).toHaveLength(3);
  });

  it("detaches only one occurrence when recurrence is stopped locally", async () => {
    const { db } = await getTestDb();
    const created = await dailyTask();
    await completeTaskAggregate(TEST_USER_ID, created.task.id);
    const [successor] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskDate, "2026-08-02"));

    await updateTaskAggregate(TEST_USER_ID, successor.id, {
      patch: { recurrence: null },
      recurrenceScope: "occurrence",
    });
    const [original] = await db.select().from(tasks).where(eq(tasks.id, created.task.id));
    const [detached] = await db.select().from(tasks).where(eq(tasks.id, successor.id));
    expect(original.recurrenceSeriesId).toBe(created.task.recurrenceSeriesId);
    expect(detached.recurrence).toBeNull();
    expect(detached.recurrenceSeriesId).toBe(created.task.recurrenceSeriesId);
    expect(detached.scheduledDate).toBe("2026-08-02");
    expect((await db.select().from(tasks)).map((task) => task.scheduledDate).sort()).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);

    await updateTaskAggregate(TEST_USER_ID, original.id, { patch: { done: false, doneAt: null } });
    await completeTaskAggregate(TEST_USER_ID, original.id);
    expect(await db.select().from(tasks)).toHaveLength(3);
  });

  it("anchors a changed future rule on its effective occurrence", async () => {
    const { db } = await getTestDb();
    const created = await dailyTask();
    await completeTaskAggregate(TEST_USER_ID, created.task.id);
    const [second] = await db.select().from(tasks).where(eq(tasks.scheduledDate, "2026-08-02"));
    await completeTaskAggregate(TEST_USER_ID, second.id);

    await updateTaskAggregate(TEST_USER_ID, second.id, {
      patch: { recurrence: { type: "monthly" } },
      recurrenceScope: "future",
    });

    const dates = (await db.select().from(tasks)).map((task) => task.scheduledDate).sort();
    expect(dates).toContain("2026-09-02");
    expect(dates).not.toContain("2026-09-01");
  });
});
