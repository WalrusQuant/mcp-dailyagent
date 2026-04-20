import type { db } from "@/lib/db/client";
import { AuthResult } from "@/lib/token-validation";

/** Context available to every MCP tool/resource/prompt handler */
export interface McpContext {
  userId: string;
  db: typeof db;
  auth: AuthResult;
}

/** Standard query result shape */
export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}
