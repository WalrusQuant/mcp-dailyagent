import { readFileSync } from "fs";
import { join } from "path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const DRIZZLE_DIR = join(process.cwd(), "drizzle");

/**
 * Replay the committed migration files (in journal order) against a fresh
 * PGlite instance. This exercises the exact SQL that ships to production,
 * so the test schema can never silently drift from the real one.
 */
async function applyMigrations(client: PGlite) {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  for (const entry of journal.entries) {
    const file = readFileSync(join(DRIZZLE_DIR, `${entry.tag}.sql`), "utf8");
    for (const stmt of file.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
}

let cached: Promise<{ client: PGlite; db: TestDb }> | null = null;

/**
 * Lazily create a singleton in-memory Postgres for the current test module.
 * Vitest isolates the module registry per test file, so each file gets its
 * own database; use {@link resetDb} between tests for a clean slate.
 */
export function getTestDb() {
  if (!cached) {
    cached = (async () => {
      const client = new PGlite();
      await applyMigrations(client);
      const db = drizzle(client, { schema });
      return { client, db };
    })();
  }
  return cached;
}

/** Default profile IDs available after {@link resetDb}. */
export const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
export const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Truncate every table (profiles cascades to all user data) and re-seed the
 * two standard profile rows. Call in a `beforeEach` so tests start isolated.
 */
export async function resetDb() {
  const { db } = await getTestDb();
  await db.execute(sql`TRUNCATE TABLE ${schema.profiles} RESTART IDENTITY CASCADE`);
  await db.insert(schema.profiles).values([
    { id: TEST_USER_ID, email: "self@example.com" },
    { id: OTHER_USER_ID, email: "other@example.com" },
  ]);
}
