import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { goals, tasks, habits, habitLogs, goalProgressLogs } from "@/lib/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeGoal(g: typeof goals.$inferSelect) {
  return {
    id: g.id,
    user_id: g.userId,
    title: g.title,
    description: g.description,
    category: g.category,
    status: g.status,
    progress: g.progress,
    progress_mode: g.progressMode,
    target_date: g.targetDate,
    completed_at: g.completedAt,
    sort_order: g.sortOrder,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "active";

  try {
    const conditions =
      statusFilter !== "all"
        ? and(eq(goals.userId, userId), eq(goals.status, statusFilter as "active" | "completed" | "abandoned"))
        : eq(goals.userId, userId);

    const goalRows = await db
      .select()
      .from(goals)
      .where(conditions)
      .orderBy(asc(goals.sortOrder), desc(goals.createdAt));

    // For auto-progress goals, compute progress from linked tasks/habits
    const autoGoals = goalRows.filter((g) => g.progressMode === "auto");
    if (autoGoals.length > 0) {
      const goalIds = autoGoals.map((g) => g.id);
      const today = new Date().toISOString().slice(0, 10);

      const [taskRows, habitRows, habitLogRows] = await Promise.all([
        db
          .select({ goalId: tasks.goalId, done: tasks.done })
          .from(tasks)
          .where(inArray(tasks.goalId, goalIds)),
        db
          .select({ id: habits.id, goalId: habits.goalId })
          .from(habits)
          .where(and(inArray(habits.goalId, goalIds), eq(habits.archived, false))),
        db
          .select({ habitId: habitLogs.habitId })
          .from(habitLogs)
          .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, today))),
      ]);

      const tasksByGoal = new Map<string, { total: number; done: number }>();
      for (const t of taskRows) {
        if (!t.goalId) continue;
        const counts = tasksByGoal.get(t.goalId) ?? { total: 0, done: 0 };
        counts.total++;
        if (t.done) counts.done++;
        tasksByGoal.set(t.goalId, counts);
      }

      const todayLogSet = new Set(habitLogRows.map((l) => l.habitId));
      const habitsByGoal = new Map<string, { total: number; completed: number }>();
      for (const h of habitRows) {
        if (!h.goalId) continue;
        const counts = habitsByGoal.get(h.goalId) ?? { total: 0, completed: 0 };
        counts.total++;
        if (todayLogSet.has(h.id)) counts.completed++;
        habitsByGoal.set(h.goalId, counts);
      }

      for (const goal of autoGoals) {
        const taskCounts = tasksByGoal.get(goal.id);
        const habitCounts = habitsByGoal.get(goal.id);

        let progress = 0;
        let hasLinked = false;

        if (taskCounts && taskCounts.total > 0) {
          hasLinked = true;
          const taskProgress = Math.round((taskCounts.done / taskCounts.total) * 100);
          if (habitCounts && habitCounts.total > 0) {
            const habitProgress = Math.round((habitCounts.completed / habitCounts.total) * 100);
            progress = Math.round((taskProgress + habitProgress) / 2);
          } else {
            progress = taskProgress;
          }
        } else if (habitCounts && habitCounts.total > 0) {
          hasLinked = true;
          progress = Math.round((habitCounts.completed / habitCounts.total) * 100);
        }

        if (hasLinked && progress !== goal.progress) {
          goal.progress = progress;
          await db
            .update(goals)
            .set({ progress, updatedAt: new Date() })
            .where(eq(goals.id, goal.id));
        }

        // Upsert today's progress log
        const existingLog = await db
          .select()
          .from(goalProgressLogs)
          .where(and(eq(goalProgressLogs.goalId, goal.id), eq(goalProgressLogs.logDate, today)));

        if (existingLog.length > 0) {
          await db
            .update(goalProgressLogs)
            .set({ progress: goal.progress })
            .where(and(eq(goalProgressLogs.goalId, goal.id), eq(goalProgressLogs.logDate, today)));
        } else {
          await db.insert(goalProgressLogs).values({
            goalId: goal.id,
            userId,
            logDate: today,
            progress: goal.progress,
          });
        }
      }
    }

    return NextResponse.json(goalRows.map(serializeGoal));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { title, description, category, target_date, progress_mode, progress, sort_order } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(goals)
      .values({
        userId,
        title: title.trim(),
        ...(description ? { description } : {}),
        ...(category ? { category } : {}),
        ...(target_date ? { targetDate: target_date } : {}),
        ...(progress_mode ? { progressMode: progress_mode } : {}),
        ...(typeof progress === "number" ? { progress } : {}),
        ...(typeof sort_order === "number" ? { sortOrder: sort_order } : {}),
      })
      .returning();

    return NextResponse.json(serializeGoal(row), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
