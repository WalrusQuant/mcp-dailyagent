import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { goals } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, conflictResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, goalCategorySchema, goalStatusSchema } from "./validators";
import { logGoalProgress } from "@/lib/mcp/queries/goals";
import { updateWithVersion } from "@/lib/db/optimistic";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getGoals(userId: string, status?: string) {
  try {
    const rows = status
      ? await db
          .select()
          .from(goals)
          .where(and(eq(goals.userId, userId), eq(goals.status, status as "active" | "completed" | "abandoned")))
          .orderBy(desc(goals.createdAt))
      : await db
          .select()
          .from(goals)
          .where(eq(goals.userId, userId))
          .orderBy(desc(goals.createdAt));

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function createGoal(
  userId: string,
  args: {
    title: string;
    description?: string;
    category?: string;
    target_date?: string;
  }
) {
  try {
    const [row] = await db
      .insert(goals)
      .values({
        userId,
        title: args.title.trim(),
        description: args.description ?? null,
        ...(args.category ? { category: args.category as "health" | "career" | "personal" | "financial" | "learning" | "relationships" | "other" } : {}),
        targetDate: args.target_date ?? null,
        status: "active" as const,
        progress: 0,
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildGoalPatch(args: {
  title?: string;
  description?: string;
  status?: string;
  progress?: number;
}): Partial<typeof goals.$inferInsert> {
  const patch: Partial<typeof goals.$inferInsert> = {};
  if (args.title !== undefined) patch.title = args.title;
  if (args.description !== undefined) patch.description = args.description;
  if (args.status !== undefined) patch.status = args.status as "active" | "completed" | "abandoned";
  if (args.progress !== undefined) patch.progress = args.progress;
  return patch;
}

async function updateGoalLegacy(
  userId: string,
  args: {
    goal_id: string;
    title?: string;
    description?: string;
    status?: string;
    progress?: number;
  }
) {
  const updates = buildGoalPatch(args);
  updates.updatedAt = new Date();

  try {
    const [row] = await db
      .update(goals)
      .set(updates)
      .where(and(eq(goals.id, args.goal_id), eq(goals.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Goal not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerGoalTools(server: McpServer) {
  // --- list_goals (READ) ---
  server.tool(
    "list_goals",
    "List goals, optionally filtered by status",
    {
      status: goalStatusSchema.optional().describe("Filter by status: active, completed, or abandoned"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getGoals(auth.userId, args.status);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_goal (WRITE) ---
  server.tool(
    "create_goal",
    "Create a new goal",
    {
      title: z.string().describe("Goal title"),
      description: z.string().optional().describe("Detailed description of the goal"),
      category: goalCategorySchema
        .optional()
        .describe("Goal category: health, career, personal, financial, learning, relationships, or other"),
      target_date: dateSchema.optional().describe("Target completion date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createGoal(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- update_goal (WRITE) ---
  server.tool(
    "update_goal",
    "Update an existing goal's details or status. Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      goal_id: z.string().describe("Goal ID"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency."),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: goalStatusSchema.optional().describe("New status: active, completed, or abandoned"),
      progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:write");
      if (scopeError) return errorResult(scopeError);

      if (args.expected_updated_at) {
        const patch = buildGoalPatch(args);
        const result = await updateWithVersion<typeof goals.$inferSelect>({
          table: goals,
          id: args.goal_id,
          userId: auth.userId,
          expectedUpdatedAt: args.expected_updated_at,
          patch,
        });
        if (result.ok) return textResult(result.row);
        if (result.reason === "not_found") return errorResult("Goal not found");
        if (result.reason === "invalid_token") return errorResult("Invalid expected_updated_at");
        return conflictResult(result.current);
      }

      const result = await updateGoalLegacy(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- log_goal_progress (WRITE) ---
  server.tool(
    "log_goal_progress",
    "Update the progress percentage for a goal",
    {
      goal_id: z.string().describe("Goal ID"),
      progress: z.number().min(0).max(100).describe("Progress percentage (0-100)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:write");
      if (scopeError) return errorResult(scopeError);

      const result = await logGoalProgress(auth.userId, args.goal_id, args.progress);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
