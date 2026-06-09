// Boot-time migration runner for the Docker image.
//
// Plain JS on drizzle-orm's programmatic migrator instead of `drizzle-kit
// migrate`: drizzle-kit needs esbuild at runtime to load the TS config, and
// esbuild only rode into the image through an npm-hoisting accident. This
// runner needs nothing beyond drizzle-orm + postgres, which the app already
// ships. It reads ./drizzle (incl. meta/_journal.json) and tracks applied
// migrations in drizzle.__drizzle_migrations — the same table drizzle-kit
// uses, so existing deployments continue seamlessly.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

// onnotice: silence "already exists, skipping" notices on re-runs.
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("[migrate] migrations up to date");
} catch (err) {
  console.error("[migrate] migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
