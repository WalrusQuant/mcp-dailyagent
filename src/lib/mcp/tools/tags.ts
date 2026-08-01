import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { tags } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { uuidSchema } from "./validators";
import { serializeTag } from "@/lib/mcp/queries/tags";
import { isUniqueViolation } from "@/lib/api-conflict";
import { updateTaskAggregate } from "@/lib/tasks/mutations";

export function registerTagTools(server: McpServer) {
  server.tool(
    "list_tags",
    "List all tags for the authenticated user",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "tags:read");
      if (scopeError) return errorResult(scopeError);

      try {
        const rows = await db
          .select()
          .from(tags)
          .where(eq(tags.userId, auth.userId))
          .orderBy(asc(tags.name));
        return textResult(rows.map(serializeTag));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );

  server.tool(
    "create_tag",
    "Create a new tag",
    {
      name: z.string().min(1).describe("Tag name"),
      color: z.string().optional().describe("Hex color, e.g. #8fb5f2"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "tags:write");
      if (scopeError) return errorResult(scopeError);

      try {
        const [row] = await db
          .insert(tags)
          .values({
            userId: auth.userId,
            name: args.name.trim(),
            color: args.color ?? "#8fb5f2",
          })
          .returning();
        return textResult(serializeTag(row));
      } catch (err) {
        if (isUniqueViolation(err)) return errorResult("Tag already exists");
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );

  server.tool(
    "update_tag",
    "Update a tag's name or color",
    {
      tag_id: uuidSchema.describe("Tag ID"),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "tags:write");
      if (scopeError) return errorResult(scopeError);

      const patch: Partial<typeof tags.$inferInsert> = {};
      if (args.name !== undefined) patch.name = args.name.trim();
      if (args.color !== undefined) patch.color = args.color;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      try {
        const [row] = await db
          .update(tags)
          .set(patch)
          .where(and(eq(tags.id, args.tag_id), eq(tags.userId, auth.userId)))
          .returning();
        if (!row) return errorResult("Tag not found");
        return textResult(serializeTag(row));
      } catch (err) {
        if (isUniqueViolation(err)) return errorResult("Tag already exists");
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );

  server.tool(
    "delete_tag",
    "Delete a tag. Removes it from all tasks.",
    {
      tag_id: uuidSchema.describe("Tag ID"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const scopeError = checkScope(auth.scopes, "tags:write");
      if (scopeError) return errorResult(scopeError);

      try {
        const deleted = await db
          .delete(tags)
          .where(and(eq(tags.id, args.tag_id), eq(tags.userId, auth.userId)))
          .returning({ id: tags.id });
        if (deleted.length === 0) return errorResult("Tag not found");
        return textResult({ success: true });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );

  server.tool(
    "set_task_tags",
    "Replace all tags on a task with the given tag IDs",
    {
      task_id: uuidSchema.describe("Task ID"),
      tag_ids: z.array(uuidSchema).describe("Tag IDs to assign (replaces existing)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;
      const hasWrite =
        auth.scopes.includes("all") ||
        auth.scopes.includes("tags:write") ||
        auth.scopes.includes("tasks:write");
      if (!hasWrite) return errorResult("Missing tags:write or tasks:write scope");

      try {
        const result = await updateTaskAggregate(auth.userId, args.task_id, {
          patch: {},
          tagIds: args.tag_ids,
        });
        return textResult({ task_id: args.task_id, tags: result.tags });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : "Unknown error");
      }
    }
  );
}
