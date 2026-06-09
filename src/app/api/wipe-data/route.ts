import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  tasks,
  habits,
  habitLogs,
  journalEntries,
  workoutTemplates,
  workoutLogs,
  focusSessions,
  goals,
  goalProgressLogs,
  spaces,
  tags,
  weeklyReviews,
  dailyBriefings,
  insightCache,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/**
 * Wipes all productivity data for the single user.
 * Leaves the `profiles` row intact so the user's identity + settings stay.
 * Child rows (habit_logs, workout_exercises, goal_progress_logs, etc.) are
 * removed by ON DELETE CASCADE when their parents go.
 */
export async function POST(request: Request) {
  // CSRF guard: the app has no auth/cookies (network-gated), so a cross-site
  // page could otherwise fire-and-forget this POST. Require a JSON confirm
  // body (cross-origin JSON needs a preflight that will fail) and reject
  // browser-flagged cross-site requests outright.
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if ((body as { confirm?: string } | null)?.confirm !== "WIPE") {
    return NextResponse.json({ error: 'Confirmation required: send {"confirm":"WIPE"}' }, { status: 400 });
  }

  try {
    const userId = getUserId();

    await db.transaction(async (tx) => {
      // Parents first (their cascades will handle children)
      await tx.delete(focusSessions).where(eq(focusSessions.userId, userId));
      await tx.delete(workoutLogs).where(eq(workoutLogs.userId, userId));
      await tx.delete(workoutTemplates).where(eq(workoutTemplates.userId, userId));
      await tx.delete(habitLogs).where(eq(habitLogs.userId, userId));
      await tx.delete(habits).where(eq(habits.userId, userId));
      await tx.delete(goalProgressLogs).where(eq(goalProgressLogs.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(goals).where(eq(goals.userId, userId));
      await tx.delete(spaces).where(eq(spaces.userId, userId));
      await tx.delete(tags).where(eq(tags.userId, userId));
      await tx.delete(journalEntries).where(eq(journalEntries.userId, userId));
      await tx.delete(weeklyReviews).where(eq(weeklyReviews.userId, userId));
      await tx.delete(dailyBriefings).where(eq(dailyBriefings.userId, userId));
      await tx.delete(insightCache).where(eq(insightCache.userId, userId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}
