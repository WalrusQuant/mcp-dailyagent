import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
  __drizzleDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function getClient() {
  if (globalForDb.__pgClient) return globalForDb.__pgClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__pgClient = client;
  }
  return client;
}

// Lazy proxy — the real connection isn't opened until a query runs.
// This keeps `next build`'s module-graph collection pass from requiring
// DATABASE_URL to be set at build time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!globalForDb.__drizzleDb) {
      globalForDb.__drizzleDb = drizzle(getClient(), { schema });
    }
    return Reflect.get(globalForDb.__drizzleDb, prop);
  },
});

export { schema };
export type Database = typeof db;
