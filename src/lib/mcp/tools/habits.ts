import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getHabits(userId: string, includeArchived = false) {
  const supabase = getServiceClient();

  let query = supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  return { data, error: error?.message ?? null };
}

async function getHabitStats(userId: string, habitId: string, days = 30) {
  const supabase = getServiceClient();

  // Verify ownership
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("*")
    .eq("id", habitId)
    .eq("user_id", userId)
    .single();

  if (habitError || !habit) {
    return { data: null, error: "Habit not found" };
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split("T")[0];

  const { data: logs, error: logsError } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .gte("log_date", fromStr)
    .order("log_date", { ascending: false });

  if (logsError) return { data: null, error: logsError.message };

  const completedDays = logs?.length ?? 0;
  const completionRate = days > 0 ? Math.round((completedDays / days) * 100) : 0;

  return {
    data: {
      habit,
      logs,
      stats: {
        completedDays,
        totalDays: days,
        completionRate,
      },
    },
    error: null,
  };
}

async function createHabit(
  userId: string,
  args: {
    name: string;
    description?: string;
    frequency?: string;
    target_days?: number[];
    color?: string;
  }
) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name: args.name,
      description: args.description ?? null,
      frequency: (args.frequency === "weekly" ? "weekly" : "daily") satisfies "daily" | "weekly",
      target_days: args.target_days ?? [0, 1, 2, 3, 4, 5, 6],
      archived: false,
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function toggleHabitLog(userId: string, habitId: string, date?: string) {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const logDate = date ?? today;

  // Verify ownership
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .single();

  if (habitError || !habit) {
    return { data: null, error: "Habit not found" };
  }

  // Check if log exists
  const { data: existing } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("log_date", logDate)
    .single();

  if (existing) {
    // Toggle off: delete the log
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", existing.id);

    return { data: { toggled: false, date: logDate }, error: error?.message ?? null };
  } else {
    // Toggle on: insert a log
    const { data, error } = await supabase
      .from("habit_logs")
      .insert({ habit_id: habitId, user_id: userId, log_date: logDate })
      .select()
      .single();

    return { data: { toggled: true, date: logDate, log: data }, error: error?.message ?? null };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerHabitTools(server: McpServer) {
  // --- list_habits (READ) ---
  server.tool(
    "list_habits",
    "List all habits for the authenticated user",
    {
      include_archived: z.boolean().optional().describe("Include archived habits (default: false)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getHabits(auth.userId, args.include_archived ?? false);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- get_habit_stats (READ) ---
  server.tool(
    "get_habit_stats",
    "Get completion statistics for a specific habit",
    {
      habit_id: z.string().describe("Habit ID"),
      days: z.number().optional().describe("Number of days to analyze (default: 30)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getHabitStats(auth.userId, args.habit_id, args.days ?? 30);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_habit (WRITE) ---
  server.tool(
    "create_habit",
    "Create a new habit to track",
    {
      name: z.string().describe("Habit name"),
      description: z.string().optional().describe("Habit description"),
      frequency: z.string().optional().describe("Frequency: daily, weekly, or custom"),
      target_days: z.array(z.number()).optional().describe("Days of week to target (0=Sunday, 6=Saturday)"),
      color: z.string().optional().describe("Color hex code for display"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:write");
      if (scopeError) return errorResult(scopeError);

      const result = await createHabit(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- toggle_habit (WRITE) ---
  server.tool(
    "toggle_habit",
    "Toggle habit completion for a given date (defaults to today)",
    {
      habit_id: z.string().describe("Habit ID"),
      date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:write");
      if (scopeError) return errorResult(scopeError);

      const result = await toggleHabitLog(auth.userId, args.habit_id, args.date);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
