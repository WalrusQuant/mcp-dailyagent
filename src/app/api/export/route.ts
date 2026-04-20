import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  profiles,
  spaces,
  tags,
  tasks,
  habits,
  habitLogs,
  journalEntries,
  workoutTemplates,
  workoutExercises,
  workoutLogs,
  workoutLogExercises,
  focusSessions,
  goals,
  goalProgressLogs,
  weeklyReviews,
  dailyBriefings,
  insightCache,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = getUserId();

    const [
      profileRows,
      spaceRows,
      tagRows,
      taskRows,
      habitRows,
      habitLogRows,
      journalRows,
      templateRows,
      workoutLogRows,
      focusRows,
      goalRows,
      goalProgressRows,
      reviewRows,
      briefingRows,
      insightRows,
    ] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.id, userId)),
      db.select().from(spaces).where(eq(spaces.userId, userId)),
      db.select().from(tags).where(eq(tags.userId, userId)),
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(habits).where(eq(habits.userId, userId)),
      db.select().from(habitLogs).where(eq(habitLogs.userId, userId)),
      db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
      db.select().from(workoutTemplates).where(eq(workoutTemplates.userId, userId)),
      db.select().from(workoutLogs).where(eq(workoutLogs.userId, userId)),
      db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(goalProgressLogs).where(eq(goalProgressLogs.userId, userId)),
      db.select().from(weeklyReviews).where(eq(weeklyReviews.userId, userId)),
      db.select().from(dailyBriefings).where(eq(dailyBriefings.userId, userId)),
      db.select().from(insightCache).where(eq(insightCache.userId, userId)),
    ]);

    const templateIds = templateRows.map((t) => t.id);
    const logIds = workoutLogRows.map((l) => l.id);

    const [exerciseRows, logExerciseRows] = await Promise.all([
      templateIds.length > 0
        ? db.select().from(workoutExercises).where(inArray(workoutExercises.templateId, templateIds))
        : Promise.resolve([]),
      logIds.length > 0
        ? db.select().from(workoutLogExercises).where(inArray(workoutLogExercises.logId, logIds))
        : Promise.resolve([]),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      data: {
        profile: profileRows[0] ?? null,
        spaces: spaceRows,
        tags: tagRows,
        tasks: taskRows,
        habits: habitRows,
        habit_logs: habitLogRows,
        journal_entries: journalRows,
        workout_templates: templateRows,
        workout_exercises: exerciseRows,
        workout_logs: workoutLogRows,
        workout_log_exercises: logExerciseRows,
        focus_sessions: focusRows,
        goals: goalRows,
        goal_progress_logs: goalProgressRows,
        weekly_reviews: reviewRows,
        daily_briefings: briefingRows,
        insight_cache: insightRows,
      },
    };

    const filename = `dailyagent-export-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
