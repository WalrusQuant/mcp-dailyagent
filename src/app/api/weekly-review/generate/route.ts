import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getModelForTask } from "@/lib/ai-models";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";

// POST generate an AI weekly review summary
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminCheck } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = adminCheck?.is_admin === true;

  const rateLimited = checkRateLimit(user.id, "ai", isAdmin);
  if (rateLimited) return rateLimited;

  const limits = await checkUsageLimits(supabase, user.id, isAdmin);
  if (limits.blocked) return usageLimitResponse(limits.reason!);

  const body = await request.json();
  const { week_start } = body;

  if (typeof week_start !== "string" || !week_start.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json(
      { error: "week_start must be a date string in YYYY-MM-DD format (Monday)" },
      { status: 400 }
    );
  }

  // Calculate week_end (6 days after week_start)
  // Parse as local date parts to avoid UTC timezone shift issues
  const [year, month, day] = week_start.split("-").map(Number);
  const weekEndDate = new Date(year, month - 1, day + 6);
  const week_end = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;

  // Fetch all data for the week in parallel
  const [
    tasksResult,
    habitsResult,
    habitLogsResult,
    journalResult,
    workoutsResult,
    focusResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, done")
      .eq("user_id", user.id)
      .gte("task_date", week_start)
      .lte("task_date", week_end),
    supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("archived", false),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date")
      .eq("user_id", user.id)
      .gte("log_date", week_start)
      .lte("log_date", week_end),
    supabase
      .from("journal_entries")
      .select("entry_date, content, mood")
      .eq("user_id", user.id)
      .gte("entry_date", week_start)
      .lte("entry_date", week_end)
      .order("entry_date", { ascending: true }),
    supabase
      .from("workout_logs")
      .select("name, duration_minutes, log_date")
      .eq("user_id", user.id)
      .gte("log_date", week_start)
      .lte("log_date", week_end)
      .order("log_date", { ascending: true }),
    supabase
      .from("focus_sessions")
      .select("duration_minutes, started_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${week_start}T00:00:00`)
      .lte("started_at", `${week_end}T23:59:59`),
  ]);

  // Build context for AI
  const tasks = tasksResult.data ?? [];
  const completedTasks = tasks.filter((t) => t.done);
  const totalTaskCount = tasks.length;
  const tasksSummary =
    totalTaskCount === 0
      ? "No tasks recorded this week."
      : `Completed ${completedTasks.length} of ${totalTaskCount} tasks.${
          completedTasks.length > 0
            ? ` Completed: ${completedTasks.map((t) => t.title).join(", ")}.`
            : ""
        }`;

  const habits = habitsResult.data ?? [];
  const habitLogs = habitLogsResult.data ?? [];
  const habitsSummary =
    habits.length === 0
      ? "No habits tracked."
      : habits
          .map((h) => {
            const logsForHabit = habitLogs.filter((l) => l.habit_id === h.id).length;
            const completionPct = Math.round((logsForHabit / 7) * 100);
            return `${h.name}: ${logsForHabit}/7 days (${completionPct}%)`;
          })
          .join("; ");

  const journalEntries = journalResult.data ?? [];
  const journalSummary =
    journalEntries.length === 0
      ? "No journal entries this week."
      : journalEntries
          .map((e) => {
            const moodStr = e.mood != null ? ` (mood: ${e.mood}/5)` : "";
            const preview = e.content.length > 300 ? e.content.slice(0, 300) + "..." : e.content;
            return `${e.entry_date}${moodStr}: ${preview}`;
          })
          .join("\n");

  const workouts = workoutsResult.data ?? [];
  const workoutsSummary =
    workouts.length === 0
      ? "No workouts logged this week."
      : workouts
          .map((w) => {
            const dur = w.duration_minutes ? ` (${w.duration_minutes} min)` : "";
            return `${w.log_date} — ${w.name}${dur}`;
          })
          .join("; ");

  const focusSessions = focusResult.data ?? [];
  const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const focusSummary =
    focusSessions.length === 0
      ? "No focus sessions this week."
      : `${focusSessions.length} sessions totaling ${totalFocusMinutes} minutes.`;

  const prompt = `You are a personal productivity coach generating a weekly review summary.

Week: ${week_start} to ${week_end}

Data from this week:

**Tasks**
${tasksSummary}

**Habits**
${habitsSummary}

**Journal Entries**
${journalSummary}

**Workouts**
${workoutsSummary}

**Focus Sessions**
${focusSummary}

Generate a weekly review summary in markdown format. Include these sections:
1. Accomplishments
2. Areas for Improvement
3. Patterns Noticed
4. Suggestions for Next Week

Be specific, encouraging, and actionable. Base all observations strictly on the data provided.`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_model_config")
    .eq("id", user.id)
    .single();

  const reviewModel = await getModelForTask(profile, "briefing");

  const completion = await complete(reviewModel, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
  });

  const content = completion.content;

  if (!content) {
    return NextResponse.json(
      { error: "AI model returned an empty response" },
      { status: 500 }
    );
  }

  return NextResponse.json({ content });
}
