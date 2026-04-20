import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { goals } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, goalCategorySchema, goalStatusSchema } from "./validators";
import { logGoalProgress } from "@/lib/mcp/queries/goals";

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
        title: args.title,
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

async function updateGoal(
  userId: string,
  args: {
    goal_id: string;
    title?: string;
    description?: string;
    status?: string;
    progress?: number;
  }
) {
  const updates: Partial<typeof goals.$inferInsert> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status as "active" | "completed" | "abandoned";
  if (args.progress !== undefined) updates.progress = args.progress;
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
    "Update an existing goal's details or status",
    {
      goal_id: z.string().describe("Goal ID"),
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

      const result = await updateGoal(auth.userId, args);
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
