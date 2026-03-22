import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getModelForTask } from "@/lib/ai-models";
import { checkRateLimit } from "@/lib/rate-limit";

interface InsightItem {
  emoji: string;
  title: string;
  body: string;
  type: "encouragement" | "warning" | "suggestion";
}

export async function GET() {
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

  const today = new Date().toISOString().slice(0, 10);

  // Check cache (stale after 6 hours)
  const { data: cached } = await supabase
    .from("insight_cache")
    .select("insights, created_at")
    .eq("user_id", user.id)
    .eq("cache_date", today)
    .maybeSingle();

  if (cached) {
    const cacheAge = Date.now() - new Date(cached.created_at).getTime();
    if (cacheAge < 6 * 60 * 60 * 1000) {
      return NextResponse.json({ insights: cached.insights });
    }
    // Stale — delete and regenerate
    await supabase.from("insight_cache").delete().eq("user_id", user.id).eq("cache_date", today);
  }

  try {
    // Gather 7 days of data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStart = sevenDaysAgo.toISOString().slice(0, 10);

    const [tasksResult, habitsResult, habitLogsResult, workoutsResult, focusResult, journalResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("done, task_date")
        .eq("user_id", user.id)
        .gte("task_date", weekStart)
        .lte("task_date", today),
      supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("archived", false),
      supabase
        .from("habit_logs")
        .select("habit_id, log_date")
        .eq("user_id", user.id)
        .gte("log_date", weekStart),
      supabase
        .from("workout_logs")
        .select("log_date")
        .eq("user_id", user.id)
        .gte("log_date", weekStart),
      supabase
        .from("focus_sessions")
        .select("duration_minutes, started_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("started_at", `${weekStart}T00:00:00.000Z`),
      supabase
        .from("journal_entries")
        .select("entry_date, mood")
        .eq("user_id", user.id)
        .gte("entry_date", weekStart),
    ]);

    // Summarize the data
    const tasks = tasksResult.data ?? [];
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.done).length;
    const taskRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const habits = habitsResult.data ?? [];
    const habitLogs = habitLogsResult.data ?? [];
    const habitLogsByDate = new Map<string, Set<string>>();
    for (const log of habitLogs) {
      if (!habitLogsByDate.has(log.log_date)) habitLogsByDate.set(log.log_date, new Set());
      habitLogsByDate.get(log.log_date)!.add(log.habit_id);
    }

    const workouts = workoutsResult.data ?? [];
    const focusSessions = focusResult.data ?? [];
    const totalFocusMin = focusSessions.reduce((s, f) => s + (f.duration_minutes ?? 0), 0);

    const journals = journalResult.data ?? [];
    const moods = journals.filter((j) => j.mood != null).map((j) => j.mood as number);
    const avgMood = moods.length > 0 ? (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1) : "N/A";

    const context = `
Weekly Summary (${weekStart} to ${today}):
- Tasks: ${doneTasks}/${totalTasks} completed (${taskRate}%)
- Habits: ${habits.length} tracked, ${habitLogsByDate.size} days with activity
- Workouts: ${workouts.length} sessions
- Focus: ${totalFocusMin} minutes across ${focusSessions.length} sessions
- Journal: ${journals.length} entries, avg mood ${avgMood}/5
`.trim();

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_model_config")
      .eq("id", user.id)
      .single();

    const model = await getModelForTask(profile, "insights");

    const response = await complete(model, {
      messages: [
        {
          role: "system",
          content: `Based on this week's productivity data, identify 1-3 actionable insights. Return ONLY a JSON array: [{ "emoji": "...", "title": "...", "body": "...", "type": "encouragement|warning|suggestion" }]. Types: encouragement (celebrating progress), warning (risk of losing streaks or falling behind), suggestion (actionable improvement). Keep titles under 6 words. Keep body under 30 words.`,
        },
        { role: "user", content: context },
      ],
      max_tokens: 500,
    });

    let insights: InsightItem[] = [];
    const raw = response.content?.trim() || "[]";
    try {
      // Extract JSON from possible markdown code block
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse insights JSON:", raw);
    }

    // Cache
    if (insights.length > 0) {
      await supabase.from("insight_cache").insert({
        user_id: user.id,
        cache_date: today,
        insights,
      });
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Insights generation failed:", error);
    return NextResponse.json({ insights: [] });
  }
}
