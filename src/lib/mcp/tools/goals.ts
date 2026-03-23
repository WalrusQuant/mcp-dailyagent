import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, PAID_PLAN_REQUIRED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getGoals(userId: string, status?: string) {
  const supabase = getServiceClient();

  let query = supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as "active" | "completed" | "abandoned");

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
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
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: args.title,
      description: args.description ?? null,
      ...(args.category
        ? { category: args.category as "health" | "career" | "personal" | "financial" | "learning" | "relationships" | "other" }
        : {}),
      target_date: args.target_date ?? null,
      status: "active" as const,
      progress: 0,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
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
  const supabase = getServiceClient();

  const updates: Record<string, unknown> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status;
  if (args.progress !== undefined) updates.progress = args.progress;

  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", args.goal_id)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function logGoalProgress(userId: string, goalId: string, progress: number) {
  const supabase = getServiceClient();

  // Verify ownership then update progress
  const { data, error } = await supabase
    .from("goals")
    .update({ progress })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
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
      status: z.string().optional().describe("Filter by status: active, completed, paused, or abandoned"),
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
      category: z.string().optional().describe("Goal category (e.g. health, career, personal)"),
      target_date: z.string().optional().describe("Target completion date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

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
      status: z.string().optional().describe("New status: active, completed, paused, or abandoned"),
      progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "goals:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

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

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await logGoalProgress(auth.userId, args.goal_id, args.progress);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
