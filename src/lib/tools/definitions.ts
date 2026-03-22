import type OpenAI from "openai";

export const TOOL_SYSTEM_INSTRUCTIONS = `You have access to the user's productivity tools. Use them when asked to create tasks, log habits, record journal entries, start focus sessions, create goals, or update goal progress. You can also read tasks, habits, workouts, focus stats, journal entries, and goals. For read-only queries, call the tool directly. For actions that create or modify data, describe what you'll do before calling the tool.`;

export const READ_ONLY_TOOLS = new Set(["get_tasks", "get_habits", "get_workouts", "get_focus_stats", "get_journal_entries", "get_goals"]);

export const PRODUCTIVITY_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the user's task list",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          priority: {
            type: "string",
            enum: ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"],
            description: "Franklin Covey priority, defaults to B1",
          },
          notes: { type: "string", description: "Optional notes" },
          task_date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task as done by title (fuzzy match against today's tasks)",
      parameters: {
        type: "object",
        properties: {
          task_title: {
            type: "string",
            description: "Title or partial title of the task to complete",
          },
        },
        required: ["task_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_habit",
      description: "Log a habit as completed for a date",
      parameters: {
        type: "object",
        properties: {
          habit_name: { type: "string", description: "Name of the habit (fuzzy match)" },
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        },
        required: ["habit_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_journal_entry",
      description: "Create a journal entry for the user",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Journal entry text" },
          mood: { type: "number", description: "Mood 1-5 (1=low, 5=great)" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_focus_session",
      description: "Start a Pomodoro focus session",
      parameters: {
        type: "object",
        properties: {
          duration_minutes: { type: "number", description: "Session length in minutes, default 25" },
          task_title: { type: "string", description: "Optional task to link the session to" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "Get the user's tasks for a specific date",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_habits",
      description: "Get the user's habits and today's completion status",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workouts",
      description: "Get the user's recent workout logs with exercises",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD, defaults to 7 days ago" },
          end_date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_focus_stats",
      description: "Get the user's focus session stats for today and this week",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_journal_entries",
      description: "Get the user's recent journal entries",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD, defaults to 7 days ago" },
          end_date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
          limit: { type: "number", description: "Max entries to return, default 5" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Create a new goal for the user",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Goal title" },
          category: { type: "string", description: "Optional category (e.g. health, career, finance)" },
          target_date: { type: "string", description: "Target completion date, YYYY-MM-DD" },
          description: { type: "string", description: "Optional description or details" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal_progress",
      description: "Update progress on a goal (manual-mode goals only). Use fuzzy title match.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title or partial title of the goal" },
          progress: { type: "number", description: "Progress percentage (0-100)" },
        },
        required: ["title", "progress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_goals",
      description: "Get the user's goals with progress and linked task/habit counts",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "completed", "abandoned"], description: "Filter by status, defaults to active" },
        },
        required: [],
      },
    },
  },
];

