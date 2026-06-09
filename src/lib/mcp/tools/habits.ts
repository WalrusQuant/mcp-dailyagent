import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { habits, habitLogs } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getAuth, checkScope, textResult, errorResult, conflictResult, NOT_AUTHENTICATED, Extra } from "./helpers";
import { dateSchema, habitFrequencySchema } from "./validators";
import { getHabitStats } from "@/lib/mcp/queries/habits";
import { updateWithVersion } from "@/lib/db/optimistic";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getHabits(userId: string, includeArchived = false) {
  try {
    const conditions = includeArchived
      ? eq(habits.userId, userId)
      : and(eq(habits.userId, userId), eq(habits.archived, false));

    const rows = await db.select().from(habits).where(conditions).orderBy(asc(habits.createdAt));
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function createHabit(
  userId: string,
  args: {
    name: string;
    description?: string;
    frequency?: "daily" | "weekly";
    target_days?: number[];
    color?: string;
  }
) {
  try {
    const [row] = await db
      .insert(habits)
      .values({
        userId,
        name: args.name,
        description: args.description ?? null,
        frequency: args.frequency ?? "daily",
        targetDays: args.target_days ?? [1, 2, 3, 4, 5, 6, 7],
        color: args.color ?? "#d4a574",
        archived: false,
      })
      .returning();
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildHabitPatch(args: {
  name?: string;
  description?: string;
  frequency?: "daily" | "weekly";
  target_days?: number[];
  color?: string;
  archived?: boolean;
}): Partial<typeof habits.$inferInsert> {
  const patch: Partial<typeof habits.$inferInsert> = {};
  if (args.name !== undefined) patch.name = args.name;
  if (args.description !== undefined) patch.description = args.description;
  if (args.frequency !== undefined) patch.frequency = args.frequency;
  if (args.target_days !== undefined) patch.targetDays = args.target_days;
  if (args.color !== undefined) patch.color = args.color;
  if (args.archived !== undefined) patch.archived = args.archived;
  return patch;
}

async function updateHabitLegacy(
  userId: string,
  args: {
    habit_id: string;
    name?: string;
    description?: string;
    frequency?: "daily" | "weekly";
    target_days?: number[];
    color?: string;
    archived?: boolean;
  }
) {
  const updates = buildHabitPatch(args);
  updates.updatedAt = new Date();

  try {
    const [row] = await db
      .update(habits)
      .set(updates)
      .where(and(eq(habits.id, args.habit_id), eq(habits.userId, userId)))
      .returning();
    return { data: row ?? null, error: row ? null : "Habit not found" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function deleteHabit(userId: string, habitId: string) {
  try {
    const deleted = await db
      .delete(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning({ id: habits.id });
    return { error: deleted.length > 0 ? null : "Habit not found" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function toggleHabitLog(userId: string, habitId: string, date?: string) {
  const today = new Date().toISOString().split("T")[0];
  const logDate = date ?? today;

  try {
    // Verify ownership
    const habitRows = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (habitRows.length === 0) return { data: null, error: "Habit not found" };

    // Check if log exists
    const existingLogs = await db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate)));

    if (existingLogs.length > 0) {
      await db.delete(habitLogs).where(eq(habitLogs.id, existingLogs[0].id));
      return { data: { toggled: false, date: logDate }, error: null };
    } else {
      const [log] = await db
        .insert(habitLogs)
        .values({ habitId, userId, logDate })
        .returning();
      return { data: { toggled: true, date: logDate, log }, error: null };
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
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
      frequency: habitFrequencySchema.optional().describe("Frequency: daily or weekly"),
      target_days: z
        .array(z.number().int().min(1).max(7))
        .optional()
        .describe("ISO days of week to target (1=Monday, 7=Sunday). Defaults to all 7 days."),
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
      date: dateSchema.optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
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

  // --- update_habit (WRITE) ---
  server.tool(
    "update_habit",
    "Update a habit's details, or archive/unarchive it via the 'archived' flag. Pass expected_updated_at to opt into concurrency-safe writes.",
    {
      habit_id: z.string().describe("Habit ID"),
      expected_updated_at: z
        .string()
        .datetime()
        .optional()
        .describe("ISO timestamp from the prior read; enables optimistic concurrency. Omit for last-write-wins."),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      frequency: habitFrequencySchema.optional().describe("New frequency: daily or weekly"),
      target_days: z
        .array(z.number().int().min(1).max(7))
        .optional()
        .describe("ISO days of week to target (1=Monday, 7=Sunday)"),
      color: z.string().optional().describe("New color hex code for display"),
      archived: z.boolean().optional().describe("Set true to archive (hide) the habit, false to restore it"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:write");
      if (scopeError) return errorResult(scopeError);

      if (args.expected_updated_at) {
        const patch = buildHabitPatch(args);
        const result = await updateWithVersion<typeof habits.$inferSelect>({
          table: habits,
          id: args.habit_id,
          userId: auth.userId,
          expectedUpdatedAt: args.expected_updated_at,
          patch,
        });
        if (result.ok) return textResult(result.row);
        if (result.reason === "not_found") return errorResult("Habit not found");
        if (result.reason === "invalid_token") return errorResult("Invalid expected_updated_at");
        return conflictResult(result.current);
      }

      const result = await updateHabitLegacy(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- delete_habit (WRITE) ---
  server.tool(
    "delete_habit",
    "Delete a habit permanently, including all of its completion logs. To keep history, archive it with update_habit instead.",
    {
      habit_id: z.string().describe("Habit ID to delete"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "habits:write");
      if (scopeError) return errorResult(scopeError);

      const result = await deleteHabit(auth.userId, args.habit_id);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult({ success: true });
    }
  );
}
