import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://dailyagent:dailyagent@localhost:5432/dailyagent",
  },
  strict: true,
  verbose: true,
} satisfies Config;
