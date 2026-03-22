import { SupabaseClient } from "@supabase/supabase-js";

export interface ProjectSummary {
  name: string;
  status: string;
  deadline: string | null;
  openTasks: number;
  doneTasks: number;
}

export interface ProductivitySnapshot {
  tasks: { total: number; done: number; topPriorities: { title: string; priority: string }[] };
  habits: { total: number; completedToday: number; streak: number };
  journal: { hasEntry: boolean; mood: number | null };
  workouts: { todayLog: boolean; weekCount: number };
  focus: { todayMinutes: number; todaySessions: number };
  projects: ProjectSummary[];
  goals: { active: number; nearDeadline: { title: string; progress: number; daysLeft: number }[] };
}

export async function getProductivitySnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<ProductivitySnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [
    tasksResult,
    habitsResult,
    habitLogsResult,
    allHabitLogsResult,
    journalResult,
    workoutTodayResult,
    workoutWeekResult,
    focusResult,
    projectsResult,
    goalsResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, done, task_date")
      .eq("user_id", userId)
      .eq("task_date", today)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habits")
      .select("id")
      .eq("user_id", userId)
      .eq("archived", false),
    supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("user_id", userId)
      .eq("log_date", today),
    supabase
      .from("habit_logs")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(1000),
    supabase
      .from("journal_entries")
      .select("mood")
      .eq("user_id", userId)
      .eq("entry_date", today)
      .maybeSingle(),
    supabase
      .from("workout_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("log_date", today)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("log_date", weekStartStr),
    supabase
      .from("focus_sessions")
      .select("duration_minutes")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("started_at", `${today}T00:00:00.000Z`)
      .lte("started_at", `${today}T23:59:59.999Z`),
    supabase
      .from("projects")
      .select("id, name, status, deadline")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("goals")
      .select("id, title, progress, target_date")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  // Tasks
  const allTasks = tasksResult.data ?? [];
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.done).length;
  const topPriorities = allTasks
    .filter((t) => !t.done)
    .slice(0, 5)
    .map((t) => ({ title: t.title, priority: t.priority }));

  // Habits
  const totalHabits = habitsResult.data?.length ?? 0;
  const completedToday = habitLogsResult.data?.length ?? 0;

  // Streak
  const logDates = new Set(
    (allHabitLogsResult.data ?? []).map((l) => l.log_date)
  );
  let streak = 0;
  const check = new Date();
  while (logDates.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  // Journal
  const hasEntry = journalResult.data !== null;
  const mood = journalResult.data?.mood ?? null;

  // Workouts
  const todayLog = workoutTodayResult.data !== null;
  const weekCount = workoutWeekResult.count ?? 0;

  // Focus
  const focusSessions = focusResult.data ?? [];
  const todayMinutes = focusSessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0
  );
  const todaySessions = focusSessions.length;

  // Projects — fetch task counts for active projects
  const activeProjects = projectsResult.data ?? [];
  let projectSummaries: ProjectSummary[] = [];
  if (activeProjects.length > 0) {
    const projectIds = activeProjects.map((p) => p.id);
    const { data: projectTasks } = await supabase
      .from("tasks")
      .select("project_id, done")
      .in("project_id", projectIds);

    const taskCounts = new Map<string, { open: number; done: number }>();
    for (const t of projectTasks ?? []) {
      if (!t.project_id) continue;
      const counts = taskCounts.get(t.project_id) ?? { open: 0, done: 0 };
      if (t.done) counts.done++;
      else counts.open++;
      taskCounts.set(t.project_id, counts);
    }

    projectSummaries = activeProjects.map((p) => ({
      name: p.name,
      status: p.status,
      deadline: p.deadline,
      openTasks: taskCounts.get(p.id)?.open ?? 0,
      doneTasks: taskCounts.get(p.id)?.done ?? 0,
    }));
  }

  // Goals
  const activeGoals = goalsResult.data ?? [];
  const nowMs = new Date().setHours(0, 0, 0, 0);
  const nearDeadline = activeGoals
    .filter((g) => g.target_date)
    .map((g) => ({
      title: g.title,
      progress: g.progress,
      daysLeft: Math.ceil((new Date(g.target_date + "T00:00:00").getTime() - nowMs) / 86400000),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  return {
    tasks: { total: totalTasks, done: doneTasks, topPriorities },
    habits: { total: totalHabits, completedToday, streak },
    journal: { hasEntry, mood },
    workouts: { todayLog, weekCount },
    focus: { todayMinutes, todaySessions },
    projects: projectSummaries,
    goals: { active: activeGoals.length, nearDeadline },
  };
}

export function formatProductivityContext(snapshot: ProductivitySnapshot): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`## Your Day (${today})`];

  // Tasks
  if (snapshot.tasks.total > 0) {
    const top = snapshot.tasks.topPriorities
      .map((t) => `"${t.title}" (${t.priority})`)
      .join(", ");
    lines.push(
      `- Tasks: ${snapshot.tasks.done}/${snapshot.tasks.total} done.${top ? ` Top: ${top}` : ""}`
    );
  } else {
    lines.push("- Tasks: none scheduled today");
  }

  // Habits
  if (snapshot.habits.total > 0) {
    lines.push(
      `- Habits: ${snapshot.habits.completedToday}/${snapshot.habits.total} today${snapshot.habits.streak > 0 ? `, ${snapshot.habits.streak}-day streak` : ""}`
    );
  }

  // Journal
  lines.push(
    snapshot.journal.hasEntry
      ? `- Journal: entry logged${snapshot.journal.mood ? ` (mood: ${snapshot.journal.mood}/5)` : ""}`
      : "- Journal: no entry yet"
  );

  // Workouts
  lines.push(
    `- Workouts: ${snapshot.workouts.weekCount} this week${snapshot.workouts.todayLog ? ", trained today" : ", none today"}`
  );

  // Focus
  if (snapshot.focus.todaySessions > 0) {
    lines.push(
      `- Focus: ${snapshot.focus.todayMinutes}min across ${snapshot.focus.todaySessions} session${snapshot.focus.todaySessions !== 1 ? "s" : ""}`
    );
  } else {
    lines.push("- Focus: no sessions today");
  }

  // Projects
  if (snapshot.projects.length > 0) {
    const projectDetails = snapshot.projects
      .map((p) => {
        const parts = [`"${p.name}" (${p.openTasks} open task${p.openTasks !== 1 ? "s" : ""}`];
        if (p.doneTasks > 0) parts[0] += `, ${p.doneTasks} done`;
        if (p.deadline) parts[0] += `, deadline ${p.deadline}`;
        return parts[0] + ")";
      })
      .join(", ");
    lines.push(
      `- Projects: ${snapshot.projects.length} active. ${projectDetails}`
    );
  }

  // Goals
  if (snapshot.goals.active > 0) {
    const goalDetails = snapshot.goals.nearDeadline
      .map((g) => `"${g.title}" (${g.progress}%, ${g.daysLeft}d left)`)
      .join(", ");
    lines.push(
      `- Goals: ${snapshot.goals.active} active${goalDetails ? `. ${goalDetails}` : ""}`
    );
  }

  return lines.join("\n") + "\n\n";
}
