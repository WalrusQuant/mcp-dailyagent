import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  check,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").default("UTC"),
  isAdmin: boolean("is_admin").notNull().default(false),
  aiModelConfig: jsonb("ai_model_config"),
  toolCallingEnabled: boolean("tool_calling_enabled").notNull().default(true),
  briefingEnabled: boolean("briefing_enabled").notNull().default(true),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------
export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    progress: integer("progress").notNull().default(0),
    deadline: date("deadline"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_spaces_user").on(t.userId),
    index("idx_spaces_user_status").on(t.userId, t.status),
    check("spaces_status_check", sql`${t.status} IN ('active', 'paused', 'completed')`),
    check("spaces_progress_check", sql`${t.progress} >= 0 AND ${t.progress} <= 100`),
  ]
);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#94a3b8"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_user_name_unique").on(t.userId, t.name)]
);

// ---------------------------------------------------------------------------
// Goals (declared before tasks/habits so FKs resolve)
// ---------------------------------------------------------------------------
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("personal"),
    status: text("status").notNull().default("active"),
    progress: integer("progress").notNull().default(0),
    progressMode: text("progress_mode").notNull().default("auto"),
    targetDate: date("target_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_goals_user_status").on(t.userId, t.status),
    check(
      "goals_category_check",
      sql`${t.category} IN ('health', 'career', 'personal', 'financial', 'learning', 'relationships', 'other')`
    ),
    check("goals_status_check", sql`${t.status} IN ('active', 'completed', 'abandoned')`),
    check("goals_progress_check", sql`${t.progress} >= 0 AND ${t.progress} <= 100`),
    check("goals_progress_mode_check", sql`${t.progressMode} IN ('auto', 'manual')`),
  ]
);

export const goalProgressLogs = pgTable(
  "goal_progress_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull().defaultNow(),
    progress: integer("progress").notNull(),
  },
  (t) => [
    index("idx_goal_progress_logs_user_date").on(t.userId, t.logDate),
    uniqueIndex("goal_progress_logs_goal_date_unique").on(t.goalId, t.logDate),
    check("goal_progress_logs_progress_check", sql`${t.progress} >= 0 AND ${t.progress} <= 100`),
  ]
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: text("priority").notNull().default("B1"),
    sortOrder: integer("sort_order").notNull().default(0),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    taskDate: date("task_date").notNull().defaultNow(),
    rolledFrom: uuid("rolled_from").references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    recurrence: jsonb("recurrence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_tasks_user_date").on(t.userId, t.taskDate),
    index("idx_tasks_user_done").on(t.userId, t.done),
    index("idx_tasks_space").on(t.spaceId),
    index("idx_tasks_goal").on(t.goalId),
    check("tasks_priority_check", sql`${t.priority} ~ '^[A-C][1-9]$'`),
  ]
);

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    frequency: text("frequency").notNull().default("daily"),
    targetDays: integer("target_days").array().default(sql`'{1,2,3,4,5,6,7}'`),
    color: text("color").notNull().default("#d4a574"),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_habits_user").on(t.userId),
    index("idx_habits_goal").on(t.goalId),
    check("habits_frequency_check", sql`${t.frequency} IN ('daily', 'weekly')`),
  ]
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_habit_logs_habit_date").on(t.habitId, t.logDate),
    index("idx_habit_logs_user_date").on(t.userId, t.logDate),
    uniqueIndex("habit_logs_habit_date_unique").on(t.habitId, t.logDate),
  ]
);

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull().defaultNow(),
    content: text("content").notNull(),
    mood: integer("mood"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_journal_user_date").on(t.userId, t.entryDate),
    index("idx_journal_search").using("gin", sql`to_tsvector('english', ${t.content})`),
    check("journal_mood_check", sql`${t.mood} >= 1 AND ${t.mood} <= 5`),
  ]
);

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------
export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_workout_templates_user").on(t.userId)]
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    exerciseType: text("exercise_type").notNull().default("strength"),
    sortOrder: integer("sort_order").notNull().default(0),
    defaultSets: integer("default_sets").default(3),
    defaultReps: integer("default_reps").default(10),
    defaultWeight: numeric("default_weight"),
    defaultDuration: integer("default_duration"),
    notes: text("notes"),
  },
  (t) => [
    index("idx_workout_exercises_template").on(t.templateId),
    check("workout_exercises_type_check", sql`${t.exerciseType} IN ('strength', 'timed', 'cardio')`),
  ]
);

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => workoutTemplates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    logDate: date("log_date").notNull().defaultNow(),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_workout_logs_user_date").on(t.userId, t.logDate)]
);

export const workoutLogExercises = pgTable(
  "workout_log_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    logId: uuid("log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    exerciseName: text("exercise_name").notNull(),
    exerciseType: text("exercise_type").notNull().default("strength"),
    sortOrder: integer("sort_order").notNull().default(0),
    sets: jsonb("sets").notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [index("idx_workout_log_exercises_log").on(t.logId)]
);

// ---------------------------------------------------------------------------
// Focus Sessions
// ---------------------------------------------------------------------------
export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    durationMinutes: integer("duration_minutes").notNull().default(25),
    breakMinutes: integer("break_minutes").notNull().default(5),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
  },
  (t) => [
    index("idx_focus_sessions_user").on(t.userId),
    index("idx_focus_sessions_user_date").on(t.userId, t.startedAt),
    index("idx_focus_sessions_task").on(t.taskId),
    check("focus_sessions_status_check", sql`${t.status} IN ('active', 'completed', 'cancelled')`),
  ]
);

// ---------------------------------------------------------------------------
// Weekly Reviews
// ---------------------------------------------------------------------------
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    content: text("content").notNull(),
    source: text("source").notNull().default("dashboard"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_weekly_reviews_user").on(t.userId),
    uniqueIndex("weekly_reviews_user_week_unique").on(t.userId, t.weekStart),
    check("weekly_reviews_source_check", sql`${t.source} IN ('dashboard', 'mcp')`),
  ]
);

// ---------------------------------------------------------------------------
// Daily Briefings
// ---------------------------------------------------------------------------
export const dailyBriefings = pgTable(
  "daily_briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    briefingDate: date("briefing_date").notNull().defaultNow(),
    content: text("content").notNull(),
    source: text("source").notNull().default("dashboard"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_briefings_user_date_unique").on(t.userId, t.briefingDate),
    check("daily_briefings_source_check", sql`${t.source} IN ('dashboard', 'mcp')`),
  ]
);

// ---------------------------------------------------------------------------
// Insight Cache
// ---------------------------------------------------------------------------
export const insightCache = pgTable(
  "insight_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    cacheDate: date("cache_date").notNull().defaultNow(),
    insights: jsonb("insights").notNull().default(sql`'[]'::jsonb`),
    source: text("source").notNull().default("dashboard"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("insight_cache_user_date_unique").on(t.userId, t.cacheDate),
    check("insight_cache_source_check", sql`${t.source} IN ('dashboard', 'mcp')`),
  ]
);

