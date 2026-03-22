import { SupabaseClient } from "@supabase/supabase-js";

export interface ToolResult {
  success: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  context?: { searchModel?: string }
): Promise<ToolResult> {
  const today = new Date().toISOString().slice(0, 10);

  switch (toolName) {
    case "create_task": {
      const title = args.title as string;
      const priority = (args.priority as string) || "B1";
      const notes = (args.notes as string) || null;
      const taskDate = (args.task_date as string) || today;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title,
          priority,
          notes,
          task_date: taskDate,
        })
        .select("id, title, priority, task_date")
        .single();

      if (error) return { success: false, summary: `Failed to create task: ${error.message}`, error: error.message };
      return { success: true, summary: `Created task "${title}" (${priority}) for ${taskDate}`, data };
    }

    case "complete_task": {
      const taskTitle = args.task_title as string;
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("user_id", userId)
        .eq("task_date", today)
        .eq("done", false)
        .ilike("title", `%${taskTitle}%`);

      if (!tasks || tasks.length === 0) {
        return { success: false, summary: `No matching task found for "${taskTitle}"` };
      }

      const task = tasks[0];
      const { error } = await supabase
        .from("tasks")
        .update({ done: true, done_at: new Date().toISOString() })
        .eq("id", task.id);

      if (error) return { success: false, summary: `Failed to complete task: ${error.message}`, error: error.message };
      return { success: true, summary: `Completed task "${task.title}"`, data: { id: task.id, title: task.title } };
    }

    case "log_habit": {
      const habitName = args.habit_name as string;
      const date = (args.date as string) || today;

      const { data: habits } = await supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", userId)
        .eq("archived", false)
        .ilike("name", `%${habitName}%`);

      if (!habits || habits.length === 0) {
        return { success: false, summary: `No matching habit found for "${habitName}"` };
      }

      const habit = habits[0];
      const { error } = await supabase
        .from("habit_logs")
        .upsert(
          { habit_id: habit.id, user_id: userId, log_date: date },
          { onConflict: "habit_id,log_date" }
        );

      if (error) return { success: false, summary: `Failed to log habit: ${error.message}`, error: error.message };
      return { success: true, summary: `Logged "${habit.name}" as done for ${date}`, data: { id: habit.id, name: habit.name } };
    }

    case "create_journal_entry": {
      const content = args.content as string;
      const mood = args.mood as number | undefined;

      if (mood !== undefined && (mood < 1 || mood > 5)) {
        return { success: false, summary: "Mood must be between 1 and 5" };
      }

      const { data, error } = await supabase
        .from("journal_entries")
        .upsert(
          {
            user_id: userId,
            entry_date: today,
            content,
            mood: mood ?? null,
          },
          { onConflict: "user_id,entry_date" }
        )
        .select("id")
        .single();

      if (error) return { success: false, summary: `Failed to create journal entry: ${error.message}`, error: error.message };
      return { success: true, summary: `Journal entry saved for ${today}${mood ? ` (mood: ${mood}/5)` : ""}`, data };
    }

    case "start_focus_session": {
      const durationMinutes = (args.duration_minutes as number) || 25;
      const taskTitle = args.task_title as string | undefined;

      let taskId: string | null = null;
      if (taskTitle) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title")
          .eq("user_id", userId)
          .eq("task_date", today)
          .ilike("title", `%${taskTitle}%`)
          .limit(1);

        if (tasks && tasks.length > 0) {
          taskId = tasks[0].id;
        }
      }

      const { data, error } = await supabase
        .from("focus_sessions")
        .insert({
          user_id: userId,
          duration_minutes: durationMinutes,
          break_minutes: 5,
          task_id: taskId,
          status: "active",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) return { success: false, summary: `Failed to start focus session: ${error.message}`, error: error.message };
      return {
        success: true,
        summary: `Started ${durationMinutes}-minute focus session${taskTitle ? ` for "${taskTitle}"` : ""}`,
        data,
      };
    }

    case "get_tasks": {
      const date = (args.date as string) || today;
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("id, title, priority, done, notes")
        .eq("user_id", userId)
        .eq("task_date", date)
        .order("sort_order", { ascending: true });

      if (error) return { success: false, summary: `Failed to get tasks: ${error.message}`, error: error.message };

      const taskList = (tasks ?? [])
        .map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title} (${t.priority})${t.notes ? " - " + t.notes : ""}`)
        .join("\n");

      return {
        success: true,
        summary: tasks?.length ? `Tasks for ${date}:\n${taskList}` : `No tasks for ${date}`,
        data: tasks,
      };
    }

    case "get_habits": {
      const { data: habits, error } = await supabase
        .from("habits")
        .select("id, name")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true });

      if (error) return { success: false, summary: `Failed to get habits: ${error.message}`, error: error.message };

      const { data: logs } = await supabase
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .eq("log_date", today);

      const completedIds = new Set((logs ?? []).map((l) => l.habit_id));
      const habitList = (habits ?? [])
        .map((h) => `${completedIds.has(h.id) ? "[x]" : "[ ]"} ${h.name}`)
        .join("\n");

      return {
        success: true,
        summary: habits?.length ? `Habits for today:\n${habitList}` : "No habits configured",
        data: { habits, completedToday: completedIds.size },
      };
    }

    case "get_workouts": {
      const startDate = (args.start_date as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const endDate = (args.end_date as string) || today;

      const { data: logs, error } = await supabase
        .from("workout_logs")
        .select("id, name, log_date, duration_minutes, notes")
        .eq("user_id", userId)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: false });

      if (error) return { success: false, summary: `Failed to get workouts: ${error.message}`, error: error.message };

      if (!logs || logs.length === 0) {
        return { success: true, summary: `No workouts from ${startDate} to ${endDate}`, data: [] };
      }

      // Fetch exercises for these logs
      const logIds = logs.map((l) => l.id);
      const { data: exercises } = await supabase
        .from("workout_log_exercises")
        .select("log_id, exercise_name, exercise_type, sets")
        .in("log_id", logIds)
        .order("sort_order", { ascending: true });

      const exercisesByLog = new Map<string, typeof exercises>();
      for (const ex of exercises ?? []) {
        if (!exercisesByLog.has(ex.log_id)) exercisesByLog.set(ex.log_id, []);
        exercisesByLog.get(ex.log_id)!.push(ex);
      }

      const summary = logs.map((l) => {
        const exList = exercisesByLog.get(l.id) ?? [];
        const exSummary = exList.map((e) => {
          const setCount = Array.isArray(e.sets) ? e.sets.length : 0;
          return `  - ${e.exercise_name} (${setCount} sets)`;
        }).join("\n");
        return `${l.log_date}: ${l.name}${l.duration_minutes ? ` (${l.duration_minutes} min)` : ""}${exSummary ? "\n" + exSummary : ""}`;
      }).join("\n");

      return { success: true, summary: `Workouts (${startDate} to ${endDate}):\n${summary}`, data: logs };
    }

    case "get_focus_stats": {
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const { data: sessions, error } = await supabase
        .from("focus_sessions")
        .select("duration_minutes, started_at, status")
        .eq("user_id", userId)
        .gte("started_at", weekStart + "T00:00:00")
        .in("status", ["completed", "active"]);

      if (error) return { success: false, summary: `Failed to get focus stats: ${error.message}`, error: error.message };

      const todaySessions = (sessions ?? []).filter((s) => s.started_at.slice(0, 10) === today);
      const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
      const weekMinutes = (sessions ?? []).reduce((sum, s) => sum + s.duration_minutes, 0);

      return {
        success: true,
        summary: `Focus stats:\n- Today: ${todaySessions.length} sessions, ${todayMinutes} minutes\n- This week: ${(sessions ?? []).length} sessions, ${weekMinutes} minutes`,
        data: { today: { sessions: todaySessions.length, minutes: todayMinutes }, week: { sessions: (sessions ?? []).length, minutes: weekMinutes } },
      };
    }

    case "get_journal_entries": {
      const startDate = (args.start_date as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const endDate = (args.end_date as string) || today;
      const limit = Math.min((args.limit as number) || 5, 20);

      const { data: entries, error } = await supabase
        .from("journal_entries")
        .select("entry_date, mood, content")
        .eq("user_id", userId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .order("entry_date", { ascending: false })
        .limit(limit);

      if (error) return { success: false, summary: `Failed to get journal entries: ${error.message}`, error: error.message };

      if (!entries || entries.length === 0) {
        return { success: true, summary: `No journal entries from ${startDate} to ${endDate}`, data: [] };
      }

      const moodLabel = ["", "Bad", "Meh", "OK", "Good", "Great"];
      const summary = entries.map((e) => {
        const mood = e.mood ? ` (${moodLabel[e.mood]})` : "";
        const preview = e.content.length > 100 ? e.content.slice(0, 100) + "..." : e.content;
        return `${e.entry_date}${mood}: ${preview}`;
      }).join("\n");

      return { success: true, summary: `Journal entries:\n${summary}`, data: entries };
    }

    case "create_goal": {
      const title = args.title as string;
      const category = (args.category as string) || null;
      const targetDate = (args.target_date as string) || null;
      const description = (args.description as string) || null;

      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title,
          category,
          target_date: targetDate,
          description,
          progress_mode: "auto",
          status: "active",
          progress: 0,
        })
        .select("id, title, category, target_date")
        .single();

      if (error) return { success: false, summary: `Failed to create goal: ${error.message}`, error: error.message };
      return {
        success: true,
        summary: `Created goal "${title}"${category ? ` (${category})` : ""}${targetDate ? ` — target: ${targetDate}` : ""}`,
        data,
      };
    }

    case "update_goal_progress": {
      const title = args.title as string;
      const progress = args.progress as number;

      if (progress < 0 || progress > 100) {
        return { success: false, summary: "Progress must be between 0 and 100" };
      }

      const { data: goals } = await supabase
        .from("goals")
        .select("id, title, progress_mode")
        .eq("user_id", userId)
        .eq("status", "active")
        .ilike("title", `%${title}%`);

      if (!goals || goals.length === 0) {
        return { success: false, summary: `No active goal found matching "${title}"` };
      }

      const goal = goals[0];
      if (goal.progress_mode !== "manual") {
        return { success: false, summary: `Goal "${goal.title}" uses auto progress tracking — progress is calculated from linked tasks/habits` };
      }

      const { error: updateError } = await supabase
        .from("goals")
        .update({ progress })
        .eq("id", goal.id);

      if (updateError) return { success: false, summary: `Failed to update progress: ${updateError.message}`, error: updateError.message };

      // Log progress entry
      await supabase
        .from("goal_progress_logs")
        .upsert(
          { goal_id: goal.id, user_id: userId, log_date: today, value: progress },
          { onConflict: "goal_id,log_date" }
        );

      return {
        success: true,
        summary: `Updated "${goal.title}" progress to ${progress}%`,
        data: { id: goal.id, title: goal.title, progress },
      };
    }

    case "get_goals": {
      const status = (args.status as string) || "active";

      const { data: goals, error } = await supabase
        .from("goals")
        .select("id, title, progress, category, target_date, status, progress_mode")
        .eq("user_id", userId)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) return { success: false, summary: `Failed to get goals: ${error.message}`, error: error.message };

      if (!goals || goals.length === 0) {
        return { success: true, summary: `No ${status} goals`, data: [] };
      }

      // Get linked task and habit counts (scoped to user)
      const goalIds = goals.map((g) => g.id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("goal_id")
        .eq("user_id", userId)
        .in("goal_id", goalIds);
      const { data: habits } = await supabase
        .from("habits")
        .select("goal_id")
        .eq("user_id", userId)
        .in("goal_id", goalIds);

      const taskCounts = new Map<string, number>();
      for (const t of tasks ?? []) {
        taskCounts.set(t.goal_id, (taskCounts.get(t.goal_id) || 0) + 1);
      }
      const habitCounts = new Map<string, number>();
      for (const h of habits ?? []) {
        habitCounts.set(h.goal_id, (habitCounts.get(h.goal_id) || 0) + 1);
      }

      const goalList = goals.map((g) => {
        const tc = taskCounts.get(g.id) || 0;
        const hc = habitCounts.get(g.id) || 0;
        const links = [tc > 0 ? `${tc} tasks` : "", hc > 0 ? `${hc} habits` : ""].filter(Boolean).join(", ");
        return `- ${g.title} (${g.progress}%)${g.category ? ` [${g.category}]` : ""}${g.target_date ? ` — due ${g.target_date}` : ""}${links ? ` (${links})` : ""}`;
      }).join("\n");

      return {
        success: true,
        summary: `${status.charAt(0).toUpperCase() + status.slice(1)} goals:\n${goalList}`,
        data: goals.map((g) => ({ ...g, task_count: taskCounts.get(g.id) || 0, habit_count: habitCounts.get(g.id) || 0 })),
      };
    }

    default:
      return { success: false, summary: `Unknown tool: ${toolName}` };
  }
}
