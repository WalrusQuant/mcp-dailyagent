import { db } from "@/lib/db/client";
import { habits, habitLogs } from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { QueryResult } from "@/lib/mcp/types";
import { getToday } from "@/lib/dates";
import { calculateStreak, getApplicableDays } from "@/lib/habit-stats";

export function serializeHabit(h: typeof habits.$inferSelect) {
  return {
    id: h.id,
    user_id: h.userId,
    name: h.name,
    description: h.description,
    frequency: h.frequency,
    target_days: h.targetDays,
    color: h.color,
    archived: h.archived,
    sort_order: h.sortOrder,
    goal_id: h.goalId,
    created_at: h.createdAt,
    updated_at: h.updatedAt,
  };
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  target_days: number[] | null;
  color: string | null;
  archived: boolean;
  sort_order: number;
  goal_id: string | null;
  created_at: string;
}

export interface HabitWithStatus extends Habit {
  logged_today: boolean;
}

export interface HabitStats {
  id: string;
  name: string;
  color: string | null;
  streak: number;
  completionRate: number;
  recentLogs: string[];
}

export interface CreateHabitInput {
  name: string;
  description?: string;
  frequency?: string;
  target_days?: number[];
  color?: string;
  goal_id?: string;
}

function rowToHabit(row: typeof habits.$inferSelect): Habit {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description ?? null,
    frequency: row.frequency ?? null,
    target_days: row.targetDays ?? null,
    color: row.color ?? null,
    archived: row.archived,
    sort_order: row.sortOrder,
    goal_id: row.goalId ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export async function getHabits(
  userId: string,
  includeArchived = false
): Promise<QueryResult<Habit[]>> {
  try {
    const conditions = includeArchived
      ? eq(habits.userId, userId)
      : and(eq(habits.userId, userId), eq(habits.archived, false));

    const rows = await db
      .select()
      .from(habits)
      .where(conditions)
      .orderBy(asc(habits.sortOrder));

    return { data: rows.map(rowToHabit), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getHabitsWithTodayStatus(
  userId: string
): Promise<QueryResult<HabitWithStatus[]>> {
  try {
    const today = getToday();

    const [habitsRows, logsRows] = await Promise.all([
      db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.archived, false)))
        .orderBy(asc(habits.sortOrder)),
      db
        .select({ habitId: habitLogs.habitId })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, today))),
    ]);

    const loggedIds = new Set(logsRows.map((l) => l.habitId));
    const habitsWithStatus: HabitWithStatus[] = habitsRows.map((h) => ({
      ...rowToHabit(h),
      logged_today: loggedIds.has(h.id),
    }));

    return { data: habitsWithStatus, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createHabit(
  userId: string,
  input: CreateHabitInput
): Promise<QueryResult<Habit>> {
  try {
    const [row] = await db
      .insert(habits)
      .values({
        userId,
        name: input.name.trim(),
        ...(input.description ? { description: input.description } : {}),
        ...(input.frequency ? { frequency: input.frequency } : {}),
        ...(input.target_days ? { targetDays: input.target_days } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.goal_id !== undefined ? { goalId: input.goal_id || null } : {}),
      })
      .returning();

    return { data: rowToHabit(row), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date: string
): Promise<QueryResult<{ logged: boolean }>> {
  try {
    // Verify the habit belongs to the user
    const habitRows = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (habitRows.length === 0) return { data: null, error: "Habit not found" };

    // Check if a log already exists
    const existingLogs = await db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, date)));

    if (existingLogs.length > 0) {
      await db.delete(habitLogs).where(eq(habitLogs.id, existingLogs[0].id));
      return { data: { logged: false }, error: null };
    } else {
      await db.insert(habitLogs).values({ habitId, logDate: date, userId });
      return { data: { logged: true }, error: null };
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getHabitStats(
  userId: string,
  habitId: string,
  days = 30
): Promise<QueryResult<HabitStats>> {
  try {
    const safeDays = Math.max(1, days);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (safeDays - 1));
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = today.toISOString().split("T")[0];

    const habitRows = await db
      .select({ id: habits.id, name: habits.name, color: habits.color, targetDays: habits.targetDays })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));

    if (habitRows.length === 0) return { data: null, error: "Habit not found" };
    const habit = habitRows[0];

    const logRows = await db
      .select({ logDate: habitLogs.logDate })
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.habitId, habitId),
          gte(habitLogs.logDate, startDateStr),
          lte(habitLogs.logDate, endDateStr)
        )
      );

    const habitLogDates = logRows.map((l) => l.logDate);
    const targetDays: number[] =
      Array.isArray(habit.targetDays) && habit.targetDays.length > 0
        ? habit.targetDays
        : [1, 2, 3, 4, 5, 6, 7];

    const streak = calculateStreak(habitLogDates, targetDays);
    const applicableDays = getApplicableDays(startDate, today, targetDays);
    const completionRate = applicableDays > 0 ? habitLogDates.length / applicableDays : 0;
    const recentLogs = [...new Set(habitLogDates)].sort().reverse();

    return {
      data: {
        id: habit.id,
        name: habit.name,
        color: habit.color ?? null,
        streak,
        completionRate: Math.min(1, completionRate),
        recentLogs,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
