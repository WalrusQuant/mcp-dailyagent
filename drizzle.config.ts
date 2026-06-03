import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://cadence:cadence@localhost:5432/cadence",
  },
  strict: true,
  verbose: true,
} satisfies Config;
