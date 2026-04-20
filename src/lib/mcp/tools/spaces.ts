import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { spaceStatusSchema } from "./validators";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getSpaces(userId: string) {
  try {
    const rows = await db
      .select()
      .from(spaces)
      .where(eq(spaces.userId, userId))
      .orderBy(desc(spaces.createdAt));
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function createSpace(
  userId: string,
  args: {
    name: string;
    description?: string;
  }
) {
  try {
    const [row] = await db
      .insert(spaces)
      .values({
        userId,
        name: args.name,
        description: args.description ?? null,
        status: "active",
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function updateSpace(
  userId: string,
  args: {
    space_id: string;
    name?: string;
    description?: string;
    status?: string;
  }
) {
  const updates: Partial<typeof spaces.$inferInsert> = {};
  if (args.name !== undefined) updates.name = args.name;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status as "active" | "paused" | "completed";
  updates.updatedAt = new Date();

  try {
    const [row] = await db
      .update(spaces)
      .set(updates)
      .where(and(eq(spaces.id, args.space_id), eq(spaces.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Space not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSpaceTools(server: McpServer) {
  // --- list_spaces (READ) ---
  server.tool(
    "list_spaces",
    "List all spaces (projects) for the authenticated user",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getSpaces(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_space (WRITE) ---
  server.tool(
    "create_space",
    "Create a new space (project) to organize tasks",
    {
      name: z.string().describe("Space name"),
      description: z.string().optional().describe("Space description"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createSpace(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- update_space (WRITE) ---
  server.tool(
    "update_space",
    "Update a space's name, description, or status",
    {
      space_id: z.string().describe("Space ID"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      status: spaceStatusSchema.optional().describe("New status: active, paused, or completed"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:write");
      if (scopeError) return errorResult(scopeError);

      const result = await updateSpace(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
