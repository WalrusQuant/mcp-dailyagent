import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "completed";
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateSpaceFields {
  name?: string;
  description?: string | null;
  status?: string;
}

function rowToSpace(row: typeof spaces.$inferSelect): Space {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description ?? null,
    status: row.status as "active" | "paused" | "completed",
    deadline: row.deadline ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getSpaces(
  _db: typeof db,
  userId: string
): Promise<QueryResult<Space[]>> {
  try {
    const rows = await db
      .select()
      .from(spaces)
      .where(eq(spaces.userId, userId))
      .orderBy(desc(spaces.updatedAt));

    return { data: rows.map(rowToSpace), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createSpace(
  _db: typeof db,
  userId: string,
  input: CreateSpaceInput
): Promise<QueryResult<Space>> {
  try {
    const [row] = await db
      .insert(spaces)
      .values({
        userId,
        name: input.name,
        description: input.description || null,
        status: (input.status as "active" | "paused" | "completed") || "active",
      })
      .returning();

    return { data: rowToSpace(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateSpace(
  _db: typeof db,
  userId: string,
  spaceId: string,
  fields: UpdateSpaceFields
): Promise<QueryResult<Space>> {
  try {
    const updates: Partial<typeof spaces.$inferInsert> = {};

    if (typeof fields.name === "string") updates.name = fields.name;
    if (typeof fields.description === "string" || fields.description === null)
      updates.description = fields.description;
    if (
      typeof fields.status === "string" &&
      ["active", "paused", "completed"].includes(fields.status)
    ) {
      updates.status = fields.status as "active" | "paused" | "completed";
    }

    updates.updatedAt = new Date();

    const [row] = await db
      .update(spaces)
      .set(updates)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)))
      .returning();

    if (!row) return { data: null, error: "Space not found" };
    return { data: rowToSpace(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
