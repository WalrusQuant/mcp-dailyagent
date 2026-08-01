import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  const schema = await import("@/lib/db/schema");
  const { db } = await getTestDb();
  return { db, schema };
});

import { tasks, tags, taskTags } from "@/lib/db/schema";
import { registerTagTools } from "@/lib/mcp/tools/tags";
import { createToolHarness, expectError } from "@/test/mcp-harness";
import { getTestDb, OTHER_USER_ID, resetDb, TEST_USER_ID } from "@/test/db-harness";
import { eq } from "drizzle-orm";

const ctx = { userId: TEST_USER_ID, scopes: ["tags:write"] };
let harness: ReturnType<typeof createToolHarness>;

beforeAll(() => {
  harness = createToolHarness(registerTagTools);
});

beforeEach(async () => {
  await resetDb();
});

describe("set_task_tags ownership", () => {
  it("rejects a foreign task without creating tag links", async () => {
    const { db } = await getTestDb();
    const [foreignTask] = await db
      .insert(tasks)
      .values({ userId: OTHER_USER_ID, title: "Private" })
      .returning();
    const [mine] = await db
      .insert(tags)
      .values({ userId: TEST_USER_ID, name: "Mine" })
      .returning();

    const result = await harness.call(
      "set_task_tags",
      { task_id: foreignTask.id, tag_ids: [mine.id] },
      ctx
    );
    expect(expectError(result)).toContain("Task not found");
    expect(await db.select().from(taskTags).where(eq(taskTags.taskId, foreignTask.id))).toHaveLength(0);
  });
});
