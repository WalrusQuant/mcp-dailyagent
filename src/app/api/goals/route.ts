import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { goals, tasks, habits, habitLogs, goalProgressLogs } from "@/lib/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeGoal } from "@/lib/mcp/queries/goals";
import { getToday } from "@/lib/dates";
import { readJsonBody } from "@/lib/api-body";

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
      const today = getToday();

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

      // Today's existing snapshots, so steady-state GETs issue no writes at all.
      const existingLogs = await db
        .select({ goalId: goalProgressLogs.goalId, progress: goalProgressLogs.progress })
        .from(goalProgressLogs)
        .where(
          and(
            eq(goalProgressLogs.userId, userId),
            eq(goalProgressLogs.logDate, today),
            inArray(goalProgressLogs.goalId, goalIds)
          )
        );
      const loggedProgress = new Map(existingLogs.map((l) => [l.goalId, l.progress]));

      const goalUpdates: { id: string; progress: number }[] = [];
      const logUpserts: { goalId: string; progress: number }[] = [];

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

        // No linked items: nothing to recompute, and logging the goal's stored
        // progress here would just write a stale snapshot.
        if (!hasLinked) continue;

        if (progress !== goal.progress) {
          goal.progress = progress;
          goalUpdates.push({ id: goal.id, progress });
        }
        if (loggedProgress.get(goal.id) !== progress) {
          logUpserts.push({ goalId: goal.id, progress });
        }
      }

      if (goalUpdates.length > 0 || logUpserts.length > 0) {
        await db.transaction(async (tx) => {
          for (const u of goalUpdates) {
            await tx
              .update(goals)
              .set({ progress: u.progress, updatedAt: new Date() })
              .where(and(eq(goals.id, u.id), eq(goals.userId, userId)));
          }
          for (const l of logUpserts) {
            // Atomic upsert on (goal_id, log_date): concurrent dashboard loads
            // can no longer race a select-then-insert into a unique violation.
            await tx
              .insert(goalProgressLogs)
              .values({ goalId: l.goalId, userId, logDate: today, progress: l.progress })
              .onConflictDoUpdate({
                target: [goalProgressLogs.goalId, goalProgressLogs.logDate],
                set: { progress: l.progress },
              });
          }
        });
      }
    }

    return NextResponse.json(goalRows.map(serializeGoal));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

const VALID_GOAL_CATEGORIES = new Set(["health", "career", "personal", "financial", "learning", "relationships", "other"]);
const VALID_PROGRESS_MODES = new Set(["auto", "manual"]);

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, category, target_date, progress_mode, progress, sort_order } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (category !== undefined && !VALID_GOAL_CATEGORIES.has(category as string)) {
    return NextResponse.json(
      { error: "category must be one of: health, career, personal, financial, learning, relationships, other" },
      { status: 400 }
    );
  }

  if (target_date !== undefined && (typeof target_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(target_date as string))) {
    return NextResponse.json({ error: "target_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (progress_mode !== undefined && !VALID_PROGRESS_MODES.has(progress_mode as string)) {
    return NextResponse.json({ error: "progress_mode must be one of: auto, manual" }, { status: 400 });
  }

  if (progress !== undefined) {
    if (typeof progress !== "number" || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      return NextResponse.json({ error: "progress must be an integer between 0 and 100" }, { status: 400 });
    }
  }

  try {
    const [row] = await db
      .insert(goals)
      .values({
        userId,
        title: title.trim(),
        ...(description ? { description: description as string } : {}),
        ...(category ? { category: category as string } : {}),
        ...(target_date ? { targetDate: target_date as string } : {}),
        ...(progress_mode ? { progressMode: progress_mode as string } : {}),
        ...(typeof progress === "number" ? { progress } : {}),
        ...(typeof sort_order === "number" ? { sortOrder: sort_order } : {}),
      })
      .returning();

    return NextResponse.json(serializeGoal(row), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
