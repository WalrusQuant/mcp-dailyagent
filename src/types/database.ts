/**
 * Serialized JSON shapes returned by the dashboard's /api/* routes and consumed
 * by UI components. Field names are snake_case to match what the API routes emit
 * (Drizzle's camelCase rows are serialized per-route before being sent).
 *
 * Canonical DB source of truth lives in src/lib/db/schema.ts. Keep this file in
 * sync when adding/removing columns.
 */

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  is_admin: boolean;
  ai_model_config: Record<string, string> | null;
  tool_calling_enabled: boolean;
  briefing_enabled: boolean;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "completed";
  progress: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskRecurrence {
  type: "daily" | "weekdays" | "weekly" | "monthly";
  days?: number[];
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  priority: string;
  sort_order: number;
  done: boolean;
  done_at: string | null;
  task_date: string;
  rolled_from: string | null;
  space_id: string | null;
  goal_id: string | null;
  recurrence: TaskRecurrence | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly";
  target_days: number[];
  color: string;
  archived: boolean;
  sort_order: number;
  goal_id: string | null;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  mood: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface WorkoutExercise {
  id: string;
  template_id: string;
  name: string;
  exercise_type: "strength" | "timed" | "cardio";
  sort_order: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
  default_duration: number | null;
  notes: string | null;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  log_date: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  reps?: number;
  weight?: number;
  duration?: number;
}

export interface WorkoutLogExercise {
  id: string;
  log_id: string;
  exercise_name: string;
  exercise_type: string;
  sort_order: number;
  sets: WorkoutSet[];
}

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  duration_minutes: number;
  break_minutes: number;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "cancelled";
  notes: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: "health" | "career" | "personal" | "financial" | "learning" | "relationships" | "other";
  status: "active" | "completed" | "abandoned";
  progress: number;
  progress_mode: "auto" | "manual";
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressLog {
  id: string;
  goal_id: string;
  user_id: string;
  log_date: string;
  progress: number;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DailyBriefing {
  id: string;
  user_id: string;
  briefing_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Insight {
  emoji: string;
  title: string;
  body: string;
  type: string;
}

export interface InsightCache {
  id: string;
  user_id: string;
  cache_date: string;
  insights: Insight[];
  created_at: string;
}
