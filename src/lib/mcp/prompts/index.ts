import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import {
  tasks as tasksTable,
  goals as goalsTable,
  habits as habitsTable,
  habitLogs,
  focusSessions,
  journalEntries,
  workoutLogs,
  workoutTemplates,
  workoutExercises,
  spaces as spacesTable,
} from "@/lib/db/schema";
import { and, eq, gte, lte, lt, or, asc, desc, inArray } from "drizzle-orm";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function getUserId(extra: Extra): string | null {
  const authInfo = (extra as unknown as { authInfo?: { extra?: Record<string, unknown> } }).authInfo;
  return (authInfo?.extra?.userId as string) ?? null;
}

// ---------------------------------------------------------------------------
// Data fetch helpers
// ---------------------------------------------------------------------------

async function fetchTodayTasks(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      priority: tasksTable.priority,
      done: tasksTable.done,
      task_date: tasksTable.taskDate,
    })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        or(
          eq(tasksTable.taskDate, today),
          and(lt(tasksTable.taskDate, today), eq(tasksTable.done, false))
        )
      )
    )
    .orderBy(asc(tasksTable.priority));
  return rows;
}

async function fetchActiveGoals(userId: string) {
  const rows = await db
    .select({
      id: goalsTable.id,
      title: goalsTable.title,
      description: goalsTable.description,
      category: goalsTable.category,
      progress: goalsTable.progress,
      target_date: goalsTable.targetDate,
      status: goalsTable.status,
    })
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")))
    .orderBy(desc(goalsTable.createdAt));
  return rows;
}

async function fetchTodayHabits(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const habits = await db
    .select({ id: habitsTable.id, name: habitsTable.name, description: habitsTable.description })
    .from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.archived, false)));

  if (habits.length === 0) return [];

  const logs = await db
    .select({ habitId: habitLogs.habitId })
    .from(habitLogs)
    .where(
      and(
        inArray(
          habitLogs.habitId,
          habits.map((h) => h.id)
        ),
        eq(habitLogs.logDate, today)
      )
    );

  const completedIds = new Set(logs.map((l) => l.habitId));
  return habits.map((h) => ({ ...h, completed_today: completedIds.has(h.id) }));
}

async function fetchAllHabitsWithStats(userId: string) {
  const habits = await db
    .select({
      id: habitsTable.id,
      name: habitsTable.name,
      description: habitsTable.description,
      frequency: habitsTable.frequency,
    })
    .from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.archived, false)));

  if (habits.length === 0) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const logs = await db
    .select({ habitId: habitLogs.habitId, logDate: habitLogs.logDate })
    .from(habitLogs)
    .where(
      and(
        inArray(
          habitLogs.habitId,
          habits.map((h) => h.id)
        ),
        gte(habitLogs.logDate, fromDate)
      )
    );

  const logsByHabit: Record<string, number> = {};
  for (const log of logs) {
    logsByHabit[log.habitId] = (logsByHabit[log.habitId] ?? 0) + 1;
  }

  return habits.map((h) => ({
    ...h,
    completionsLast30Days: logsByHabit[h.id] ?? 0,
    completionRate: Math.round(((logsByHabit[h.id] ?? 0) / 30) * 100),
  }));
}

async function fetchTodayFocusStats(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select({
      id: focusSessions.id,
      duration_minutes: focusSessions.durationMinutes,
      completed_at: focusSessions.completedAt,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        gte(focusSessions.startedAt, new Date(`${today}T00:00:00.000Z`)),
        lte(focusSessions.startedAt, new Date(`${today}T23:59:59.999Z`))
      )
    );

  const completed = rows.filter((s) => s.completed_at != null);
  const totalMinutes = completed.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  return {
    totalSessions: rows.length,
    completedSessions: completed.length,
    totalFocusMinutes: totalMinutes,
  };
}

async function fetchRecentJournal(userId: string, limit = 7) {
  const rows = await db
    .select({
      id: journalEntries.id,
      entry_date: journalEntries.entryDate,
      content: journalEntries.content,
      mood: journalEntries.mood,
    })
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.entryDate))
    .limit(limit);
  return rows;
}

async function fetchRecentWorkouts(userId: string, limit = 5) {
  const rows = await db
    .select({
      id: workoutLogs.id,
      name: workoutLogs.name,
      log_date: workoutLogs.logDate,
      duration_minutes: workoutLogs.durationMinutes,
    })
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, userId))
    .orderBy(desc(workoutLogs.logDate))
    .limit(limit);
  return rows;
}

async function fetchWorkoutTemplates(userId: string) {
  const templates = await db
    .select({ id: workoutTemplates.id, name: workoutTemplates.name })
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, userId))
    .orderBy(desc(workoutTemplates.createdAt));

  if (templates.length === 0) return [];

  const exercises = await db
    .select({ templateId: workoutExercises.templateId, name: workoutExercises.name })
    .from(workoutExercises)
    .where(
      inArray(
        workoutExercises.templateId,
        templates.map((t) => t.id)
      )
    );

  const byTemplate: Record<string, { name: string }[]> = {};
  for (const ex of exercises) {
    (byTemplate[ex.templateId] ??= []).push({ name: ex.name });
  }

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    workout_exercises: byTemplate[t.id] ?? [],
  }));
}

async function fetchGoalById(userId: string, goalId: string) {
  const [row] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)));
  return row ?? null;
}

async function fetchSpaceTasks(userId: string, spaceId?: string) {
  const conds = [
    eq(tasksTable.userId, userId),
    eq(tasksTable.done, false),
    ...(spaceId ? [eq(tasksTable.spaceId, spaceId)] : []),
  ];
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      priority: tasksTable.priority,
      done: tasksTable.done,
      task_date: tasksTable.taskDate,
      space_id: tasksTable.spaceId,
    })
    .from(tasksTable)
    .where(and(...conds))
    .orderBy(asc(tasksTable.priority))
    .limit(50);
  return rows;
}

async function fetchFocusSessionsForRange(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: focusSessions.id,
      duration_minutes: focusSessions.durationMinutes,
      completed_at: focusSessions.completedAt,
      started_at: focusSessions.startedAt,
    })
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        gte(focusSessions.startedAt, new Date(`${from}T00:00:00.000Z`)),
        lte(focusSessions.startedAt, new Date(`${to}T23:59:59.999Z`))
      )
    );
  return rows;
}

async function fetchTasksForRange(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      priority: tasksTable.priority,
      done: tasksTable.done,
      task_date: tasksTable.taskDate,
    })
    .from(tasksTable)
    .where(
      and(eq(tasksTable.userId, userId), gte(tasksTable.taskDate, from), lte(tasksTable.taskDate, to))
    );
  return rows;
}

async function fetchHabitLogsForRange(userId: string, from: string, to: string) {
  const habits = await db
    .select({ id: habitsTable.id, name: habitsTable.name })
    .from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.archived, false)));

  if (habits.length === 0) return { habits: [], logs: [] };

  const logs = await db
    .select({ habitId: habitLogs.habitId, logDate: habitLogs.logDate })
    .from(habitLogs)
    .where(
      and(
        inArray(
          habitLogs.habitId,
          habits.map((h) => h.id)
        ),
        gte(habitLogs.logDate, from),
        lte(habitLogs.logDate, to)
      )
    );

  return {
    habits,
    logs: logs.map((l) => ({ habit_id: l.habitId, log_date: l.logDate })),
  };
}

async function fetchSpaces(userId: string) {
  const rows = await db
    .select({
      id: spacesTable.id,
      name: spacesTable.name,
      description: spacesTable.description,
      status: spacesTable.status,
    })
    .from(spacesTable)
    .where(eq(spacesTable.userId, userId));
  return rows;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerPrompts(server: McpServer) {
  // 1. daily_planning
  server.prompt(
    "daily_planning",
    "Plan my day based on tasks, habits, and calendar",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [tasks, habits, goals] = await Promise.all([
        fetchTodayTasks(userId),
        fetchTodayHabits(userId),
        fetchActiveGoals(userId),
      ]);

      const today = new Date().toISOString().split("T")[0];

      const systemText = `You are a productivity coach helping plan a focused, intentional day. Use the Franklin Covey A/B/C priority system to guide task ordering. A = must do today, B = should do, C = nice to have.`;

      const userText = `Please help me plan my day for ${today}.

## Today's Tasks
${JSON.stringify(tasks, null, 2)}

## Habits to Track Today
${JSON.stringify(habits, null, 2)}

## Active Goals
${JSON.stringify(goals, null, 2)}

Based on this data, please:
1. Identify my top 3 priority tasks for today (A-priority or most impactful)
2. Suggest a time-blocked schedule
3. Highlight any habits I haven't completed yet
4. Note which tasks align with my active goals
5. Give me a motivating focus for the day`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: systemText } },
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 2. morning_briefing
  server.prompt(
    "morning_briefing",
    "Quick morning snapshot of what's ahead today",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [tasks, habits, goals] = await Promise.all([
        fetchTodayTasks(userId),
        fetchTodayHabits(userId),
        fetchActiveGoals(userId),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const pendingTasks = tasks.filter((t) => !t.done);
      const aCount = pendingTasks.filter((t) => t.priority.startsWith("A")).length;

      const userText = `Good morning! Give me a quick, energizing briefing for ${today}.

## What's on My Plate
- ${pendingTasks.length} tasks pending (${aCount} are A-priority)
- ${habits.length} habits to track today
- ${goals.length} active goals in progress

### Task Details
${JSON.stringify(pendingTasks.slice(0, 10), null, 2)}

### Habits
${JSON.stringify(habits, null, 2)}

Keep it brief: 3-4 bullet points on what matters most today, then a one-sentence motivational close.`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 3. end_of_day_review
  server.prompt(
    "end_of_day_review",
    "Review what got done today and reflect on the day",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [tasks, habits, focusStats] = await Promise.all([
        fetchTodayTasks(userId),
        fetchTodayHabits(userId),
        fetchTodayFocusStats(userId),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const completed = tasks.filter((t) => t.done);
      const incomplete = tasks.filter((t) => !t.done);
      const habitsCompleted = habits.filter((h) => h.completed_today);

      const userText = `Help me wrap up my day for ${today} with a structured end-of-day review.

## What I Accomplished
### Completed Tasks (${completed.length})
${JSON.stringify(completed, null, 2)}

### Incomplete Tasks (${incomplete.length})
${JSON.stringify(incomplete, null, 2)}

### Habits Completed (${habitsCompleted.length}/${habits.length})
${JSON.stringify(habitsCompleted, null, 2)}

### Focus Time
- Total focus minutes: ${focusStats.totalFocusMinutes}
- Completed sessions: ${focusStats.completedSessions}

Please provide:
1. A brief celebration of what I accomplished
2. Honest assessment of what didn't get done and why
3. The top 3 tasks to carry into tomorrow
4. A reflection question for my journal tonight`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 4. productivity_report
  server.prompt(
    "productivity_report",
    "Generate a detailed productivity report for a date range",
    {
      from: z.string().describe("Start date in YYYY-MM-DD format"),
      to: z.string().describe("End date in YYYY-MM-DD format"),
    },
    async (args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [focusRows, tasks, habitData] = await Promise.all([
        fetchFocusSessionsForRange(userId, args.from, args.to),
        fetchTasksForRange(userId, args.from, args.to),
        fetchHabitLogsForRange(userId, args.from, args.to),
      ]);

      const completedFocus = focusRows.filter((s) => s.completed_at != null);
      const totalFocusMinutes = completedFocus.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      const completedTasks = tasks.filter((t) => t.done);

      const aTasks = tasks.filter((t) => t.priority.startsWith("A"));
      const bTasks = tasks.filter((t) => t.priority.startsWith("B"));
      const cTasks = tasks.filter((t) => t.priority.startsWith("C"));

      const userText = `Generate a productivity report for ${args.from} to ${args.to}.

## Task Summary
- Total tasks: ${tasks.length}
- Completed: ${completedTasks.length} (${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}% completion rate)
- By priority: A=${aTasks.filter((t) => t.done).length}/${aTasks.length}, B=${bTasks.filter((t) => t.done).length}/${bTasks.length}, C=${cTasks.filter((t) => t.done).length}/${cTasks.length}

## Focus Sessions
- Total sessions: ${completedFocus.length}
- Total focus time: ${totalFocusMinutes} minutes (${Math.round(totalFocusMinutes / 60 * 10) / 10} hours)

## Habit Tracking
- Habits tracked: ${habitData.habits.length}
- Total habit completions: ${habitData.logs.length}

Please provide:
1. Overall productivity score and assessment
2. Strengths and patterns observed
3. Areas for improvement
4. Specific recommendations for the next period`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 5. habit_analysis
  server.prompt(
    "habit_analysis",
    "Analyze habit patterns and suggest improvements",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const habits = await fetchAllHabitsWithStats(userId);

      const strongHabits = habits.filter((h) => h.completionRate >= 70);
      const weakHabits = habits.filter((h) => h.completionRate < 40);

      const userText = `Analyze my habit patterns and help me build better consistency.

## My Habits (Last 30 Days)
${JSON.stringify(habits, null, 2)}

## Quick Stats
- Total habits: ${habits.length}
- Strong habits (≥70% completion): ${strongHabits.length}
- Struggling habits (<40% completion): ${weakHabits.length}

Please:
1. Identify my strongest habits and why they're working
2. Diagnose the habits I'm struggling with
3. Suggest habit stacking opportunities (linking weak habits to strong ones)
4. Recommend 1-2 habits to add or remove based on the patterns
5. Give me a concrete improvement plan for the next 2 weeks`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 6. goal_check_in
  server.prompt(
    "goal_check_in",
    "Check progress on active goals and identify next actions",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const goals = await fetchActiveGoals(userId);

      const userText = `Help me do a goal check-in and identify what needs attention.

## Active Goals
${JSON.stringify(goals, null, 2)}

For each goal, please:
1. Assess whether progress looks on track given any target dates
2. Identify which goal needs the most attention right now
3. Suggest 1-3 concrete next actions for the top priority goal
4. Flag any goals that may need to be revised or abandoned
5. Give an overall goals health score (1-10) and why`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 7. weekly_trends
  server.prompt(
    "weekly_trends",
    "Compare this week vs last week across all productivity metrics",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + diffToMonday);
      const thisWeekStart = thisMonday.toISOString().split("T")[0];

      const thisSunday = new Date(thisMonday);
      thisSunday.setDate(thisMonday.getDate() + 6);
      const thisWeekEnd = thisSunday.toISOString().split("T")[0];

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastWeekStart = lastMonday.toISOString().split("T")[0];

      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      const lastWeekEnd = lastSunday.toISOString().split("T")[0];

      const [thisWeekTasks, lastWeekTasks, thisWeekFocus, lastWeekFocus, thisWeekHabits, lastWeekHabits] =
        await Promise.all([
          fetchTasksForRange(userId, thisWeekStart, thisWeekEnd),
          fetchTasksForRange(userId, lastWeekStart, lastWeekEnd),
          fetchFocusSessionsForRange(userId, thisWeekStart, thisWeekEnd),
          fetchFocusSessionsForRange(userId, lastWeekStart, lastWeekEnd),
          fetchHabitLogsForRange(userId, thisWeekStart, thisWeekEnd),
          fetchHabitLogsForRange(userId, lastWeekStart, lastWeekEnd),
        ]);

      const thisWeekCompleted = thisWeekTasks.filter((t) => t.done);
      const lastWeekCompleted = lastWeekTasks.filter((t) => t.done);

      const thisWeekFocusMin = thisWeekFocus
        .filter((s) => s.completed_at)
        .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      const lastWeekFocusMin = lastWeekFocus
        .filter((s) => s.completed_at)
        .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

      const userText = `Compare my productivity this week vs last week.

## This Week (${thisWeekStart} – ${thisWeekEnd})
- Tasks: ${thisWeekCompleted.length}/${thisWeekTasks.length} completed
- Focus time: ${thisWeekFocusMin} minutes
- Habit completions: ${thisWeekHabits.logs.length}

## Last Week (${lastWeekStart} – ${lastWeekEnd})
- Tasks: ${lastWeekCompleted.length}/${lastWeekTasks.length} completed
- Focus time: ${lastWeekFocusMin} minutes
- Habit completions: ${lastWeekHabits.logs.length}

Please:
1. Identify the biggest improvements this week
2. Flag any areas where I regressed
3. Explain what likely drove the differences
4. Give 2-3 specific actions to improve next week`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 8. weekly_review
  server.prompt(
    "weekly_review",
    "Generate a structured weekly review covering wins, losses, and next week's plan",
    {
      week_start: z.string().optional().describe("Week start date in YYYY-MM-DD format (defaults to this Monday)"),
    },
    async (args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      let weekStart = args.week_start;
      if (!weekStart) {
        const now = new Date();
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        now.setDate(now.getDate() + diff);
        weekStart = now.toISOString().split("T")[0];
      }

      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEnd = weekEndDate.toISOString().split("T")[0];

      const [tasks, habitData, focusRows, journal] = await Promise.all([
        fetchTasksForRange(userId, weekStart, weekEnd),
        fetchHabitLogsForRange(userId, weekStart, weekEnd),
        fetchFocusSessionsForRange(userId, weekStart, weekEnd),
        fetchRecentJournal(userId, 7),
      ]);

      const completedTasks = tasks.filter((t) => t.done);
      const completedFocus = focusRows.filter((s) => s.completed_at);
      const totalFocusMin = completedFocus.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      const weekJournal = journal.filter(
        (e) => (e.entry_date as string) >= weekStart! && (e.entry_date as string) <= weekEnd
      );

      const userText = `Generate a structured weekly review for the week of ${weekStart}.

## Week Data

### Tasks
- Total: ${tasks.length}
- Completed: ${completedTasks.length}
- Completion rate: ${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
- Completed titles: ${completedTasks.map((t) => t.title).join(", ") || "none"}
- Incomplete: ${tasks.filter((t) => !t.done).map((t) => t.title).join(", ") || "none"}

### Habits
- Tracking ${habitData.habits.length} habits
- Total completions: ${habitData.logs.length}

### Focus
- Total focus time: ${totalFocusMin} minutes
- Sessions completed: ${completedFocus.length}

### Journal
- Entries written: ${weekJournal.length}

Please structure the review with:
1. **Wins** — What went well this week?
2. **Challenges** — What got in the way?
3. **Lessons** — What did I learn?
4. **Next week's intention** — Top 3 focus areas
5. **Carry-forward tasks** — What needs to move to next week?`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 9. journal_prompt
  server.prompt(
    "journal_prompt",
    "Get a thoughtful, personalized journal prompt based on recent activity",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [recentJournal, tasks, habits] = await Promise.all([
        fetchRecentJournal(userId, 5),
        fetchTodayTasks(userId),
        fetchTodayHabits(userId),
      ]);

      const today = new Date().toISOString().split("T")[0];
      const completedToday = tasks.filter((t) => t.done);
      const habitsCompleted = habits.filter((h) => h.completed_today);

      const recentMoods = recentJournal.filter((e) => e.mood != null).map((e) => e.mood as number);
      const avgMood = recentMoods.length > 0
        ? recentMoods.reduce((a: number, b) => a + b, 0) / recentMoods.length
        : null;

      const userText = `Generate a thoughtful, personalized journal prompt for me today (${today}).

## Context About My Day
- Completed ${completedToday.length} tasks including: ${completedToday.slice(0, 3).map((t) => t.title).join(", ") || "none"}
- Completed ${habitsCompleted.length}/${habits.length} habits
- Recent mood trend: ${avgMood ? `${avgMood.toFixed(1)}/5 average over last ${recentMoods.length} entries` : "no recent data"}

## Recent Journal Themes
${recentJournal.slice(0, 3).map((e) => `${e.entry_date}: ${(e.content as string)?.slice(0, 150)}...`).join("\n") || "No recent entries"}

Generate 1 deep, specific journal prompt that:
- Connects to what I actually did today
- Encourages meaningful reflection (not surface-level)
- Ties to growth or patterns you notice
- Feels personal, not generic

Follow with 2-3 shorter follow-up questions if they want to go deeper.`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 10. workout_suggestion
  server.prompt(
    "workout_suggestion",
    "Suggest a workout based on recent training history and available templates",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [recentWorkouts, templates] = await Promise.all([
        fetchRecentWorkouts(userId, 7),
        fetchWorkoutTemplates(userId),
      ]);

      const today = new Date().toISOString().split("T")[0];

      const userText = `Suggest the best workout for me today (${today}).

## Recent Workouts (Last 7)
${JSON.stringify(recentWorkouts, null, 2)}

## My Saved Templates
${JSON.stringify(templates, null, 2)}

Please:
1. Identify what muscle groups/types I've recently trained
2. Recommend what I should focus on today based on recovery needs
3. Suggest either a specific saved template or a custom workout plan
4. Include sets/reps if creating a custom plan
5. Estimate total time needed`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 11. goal_planning
  server.prompt(
    "goal_planning",
    "Break down a goal into actionable tasks and a step-by-step plan",
    {
      goal_id: z.string().describe("Goal ID to plan for"),
    },
    async (args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const goal = await fetchGoalById(userId, args.goal_id);

      if (!goal) {
        return {
          messages: [{ role: "user" as const, content: { type: "text" as const, text: "Goal not found" } }],
        };
      }

      const userText = `Help me create a concrete action plan for this goal.

## Goal Details
${JSON.stringify(goal, null, 2)}

Please provide:
1. **Milestone breakdown** — 3-5 major milestones to reach this goal
2. **Weekly task plan** — Specific tasks for the first 2 weeks (formatted as a task list I can add to Daily Agent MCP)
3. **Daily habits to support it** — 1-2 daily habits that would accelerate progress
4. **Potential blockers** — What might get in the way and how to pre-empt them
5. **Success metrics** — How will I know I'm making real progress?

Format tasks as: [PRIORITY: A/B/C] Task title`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 12. space_planning
  server.prompt(
    "space_planning",
    "Plan and prioritize work within a specific space or project",
    {
      space_id: z.string().optional().describe("Space ID to plan for (if omitted, shows all unassigned tasks)"),
    },
    async (args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [tasks, spaces] = await Promise.all([
        fetchSpaceTasks(userId, args.space_id),
        fetchSpaces(userId),
      ]);

      const space = args.space_id ? spaces.find((s) => s.id === args.space_id) : null;

      const userText = `Help me plan and prioritize work${space ? ` in the "${space.name}" space` : " across all my spaces"}.

${space ? `## Space: ${space.name}\n${space.description ? `Description: ${space.description}` : ""}` : "## All Spaces\n" + JSON.stringify(spaces, null, 2)}

## Current Tasks (${tasks.length} open)
${JSON.stringify(tasks, null, 2)}

Please:
1. Group tasks by theme or dependency
2. Identify the highest-impact tasks to tackle first
3. Flag any tasks that seem stale or could be deleted
4. Suggest a sprint plan: what to focus on this week vs later
5. Identify any missing tasks based on the space's apparent goals`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );

  // 13. week_planning
  server.prompt(
    "week_planning",
    "Plan the upcoming week with priorities, goals alignment, and a day-by-day schedule",
    {},
    async (_args, extra: Extra) => {
      const userId = getUserId(extra);
      if (!userId) return { messages: [{ role: "user" as const, content: { type: "text" as const, text: "Not authenticated" } }] };

      const [tasks, goals, habits] = await Promise.all([
        fetchTodayTasks(userId),
        fetchActiveGoals(userId),
        fetchAllHabitsWithStats(userId),
      ]);

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + diffToMonday);
      const nextWeekStart = nextMonday.toISOString().split("T")[0];

      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      const nextWeekEnd = nextSunday.toISOString().split("T")[0];

      const pendingTasks = tasks.filter((t) => !t.done);

      const userText = `Help me plan my upcoming week (${nextWeekStart} – ${nextWeekEnd}).

## Carry-Forward Tasks (${pendingTasks.length} incomplete)
${JSON.stringify(pendingTasks, null, 2)}

## Active Goals
${JSON.stringify(goals, null, 2)}

## Habit Consistency (Last 30 Days)
${JSON.stringify(habits.map((h) => ({ name: h.name, completionRate: h.completionRate })), null, 2)}

Please create:
1. **Weekly theme/intention** — One sentence focus for the week
2. **Top 5 priority tasks** — The must-do items this week (mark A-priority)
3. **Goal actions** — 1 concrete task per active goal to advance it this week
4. **Day-by-day sketch** — Light schedule suggestion (Mon–Fri)
5. **Habit focus** — Which 1-2 habits to prioritize building this week based on consistency data`;

      return {
        messages: [
          { role: "user" as const, content: { type: "text" as const, text: userText } },
        ],
      };
    }
  );
}
