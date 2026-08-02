import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const { getTestDb } = await import("@/test/db-harness");
  return { db: (await getTestDb()).db };
});

import { eq } from "drizzle-orm";
import { profiles } from "@/lib/db/schema";
import { getProfileCapabilities } from "@/lib/profile-capabilities";
import { getTestDb, resetDb, TEST_USER_ID } from "@/test/db-harness";

describe("profile capability gates", () => {
  beforeEach(resetDb);

  it("resolves stored briefing and tool-call restrictions", async () => {
    const { db } = await getTestDb();
    await db
      .update(profiles)
      .set({ briefingEnabled: false, toolCallingEnabled: false })
      .where(eq(profiles.id, TEST_USER_ID));

    await expect(getProfileCapabilities(TEST_USER_ID)).resolves.toEqual({
      briefingEnabled: false,
      toolCallingEnabled: false,
    });
  });
});
