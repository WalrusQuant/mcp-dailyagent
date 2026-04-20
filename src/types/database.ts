export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          is_admin?: boolean;
          ai_model_config?: Record<string, string> | null;
          tool_calling_enabled?: boolean;
          briefing_enabled?: boolean;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          is_admin?: boolean;
          ai_model_config?: Record<string, string> | null;
          tool_calling_enabled?: boolean;
          briefing_enabled?: boolean;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          status: "active" | "paused" | "completed";
          progress: number;
          deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          status?: "active" | "paused" | "completed";
          progress?: number;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          status?: "active" | "paused" | "completed";
          progress?: number;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
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
          recurrence: { type: "daily" | "weekdays" | "weekly" | "monthly"; days?: number[] } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string | null;
          priority?: string;
          sort_order?: number;
          done?: boolean;
          done_at?: string | null;
          task_date?: string;
          rolled_from?: string | null;
          space_id?: string | null;
          goal_id?: string | null;
          recurrence?: { type: "daily" | "weekdays" | "weekly" | "monthly"; days?: number[] } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          notes?: string | null;
          priority?: string;
          sort_order?: number;
          done?: boolean;
          done_at?: string | null;
          task_date?: string;
          rolled_from?: string | null;
          space_id?: string | null;
          goal_id?: string | null;
          recurrence?: { type: "daily" | "weekdays" | "weekly" | "monthly"; days?: number[] } | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          frequency?: "daily" | "weekly";
          target_days?: number[];
          color?: string;
          archived?: boolean;
          sort_order?: number;
          goal_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          frequency?: "daily" | "weekly";
          target_days?: number[];
          color?: string;
          archived?: boolean;
          sort_order?: number;
          goal_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          id: string;
          habit_id: string;
          user_id: string;
          log_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          user_id: string;
          log_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          user_id?: string;
          log_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          content: string;
          mood: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date?: string;
          content: string;
          mood?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          content?: string;
          mood?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_exercises: {
        Row: {
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
        };
        Insert: {
          id?: string;
          template_id: string;
          name: string;
          exercise_type?: "strength" | "timed" | "cardio";
          sort_order?: number;
          default_sets?: number | null;
          default_reps?: number | null;
          default_weight?: number | null;
          default_duration?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          name?: string;
          exercise_type?: "strength" | "timed" | "cardio";
          sort_order?: number;
          default_sets?: number | null;
          default_reps?: number | null;
          default_weight?: number | null;
          default_duration?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          template_id: string | null;
          name: string;
          log_date: string;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id?: string | null;
          name: string;
          log_date?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string | null;
          name?: string;
          log_date?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_log_exercises: {
        Row: {
          id: string;
          log_id: string;
          exercise_name: string;
          exercise_type: string;
          sort_order: number;
          sets: Array<{ reps?: number; weight?: number; duration?: number }>;
        };
        Insert: {
          id?: string;
          log_id: string;
          exercise_name: string;
          exercise_type?: string;
          sort_order?: number;
          sets?: Array<{ reps?: number; weight?: number; duration?: number }>;
        };
        Update: {
          id?: string;
          log_id?: string;
          exercise_name?: string;
          exercise_type?: string;
          sort_order?: number;
          sets?: Array<{ reps?: number; weight?: number; duration?: number }>;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          duration_minutes: number;
          break_minutes: number;
          started_at: string;
          completed_at: string | null;
          status: "active" | "completed" | "cancelled";
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          duration_minutes?: number;
          break_minutes?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: "active" | "completed" | "cancelled";
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          duration_minutes?: number;
          break_minutes?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: "active" | "completed" | "cancelled";
          notes?: string | null;
        };
        Relationships: [];
      };
      goals: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: "health" | "career" | "personal" | "financial" | "learning" | "relationships" | "other";
          status?: "active" | "completed" | "abandoned";
          progress?: number;
          progress_mode?: "auto" | "manual";
          target_date?: string | null;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          category?: "health" | "career" | "personal" | "financial" | "learning" | "relationships" | "other";
          status?: "active" | "completed" | "abandoned";
          progress?: number;
          progress_mode?: "auto" | "manual";
          target_date?: string | null;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      goal_progress_logs: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          log_date: string;
          progress: number;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          log_date?: string;
          progress: number;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          log_date?: string;
          progress?: number;
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          content: string;
          source: "dashboard" | "mcp";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          content: string;
          source?: "dashboard" | "mcp";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          content?: string;
          source?: "dashboard" | "mcp";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_briefings: {
        Row: {
          id: string;
          user_id: string;
          briefing_date: string;
          content: string;
          source: "dashboard" | "mcp";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          briefing_date?: string;
          content: string;
          source?: "dashboard" | "mcp";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          briefing_date?: string;
          content?: string;
          source?: "dashboard" | "mcp";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      insight_cache: {
        Row: {
          id: string;
          user_id: string;
          cache_date: string;
          insights: Array<{ emoji: string; title: string; body: string; type: string }>;
          source: "dashboard" | "mcp";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cache_date?: string;
          insights: Array<{ emoji: string; title: string; body: string; type: string }>;
          source?: "dashboard" | "mcp";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          cache_date?: string;
          insights?: Array<{ emoji: string; title: string; body: string; type: string }>;
          source?: "dashboard" | "mcp";
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: string;
          is_encrypted: boolean;
          category: string;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: string;
          is_encrypted?: boolean;
          category?: string;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: string;
          is_encrypted?: boolean;
          category?: string;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      app_models: {
        Row: {
          id: string;
          model_id: string;
          name: string;
          provider: string;
          description: string;
          type: "chat" | "image";
          is_default: boolean;
          sort_order: number;
          provider_id: string | null;
          api_model_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          model_id: string;
          name: string;
          provider: string;
          description?: string;
          type?: "chat" | "image";
          is_default?: boolean;
          sort_order?: number;
          provider_id?: string | null;
          api_model_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          model_id?: string;
          name?: string;
          provider?: string;
          description?: string;
          type?: "chat" | "image";
          is_default?: boolean;
          sort_order?: number;
          provider_id?: string | null;
          api_model_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      llm_providers: {
        Row: {
          id: string;
          name: string;
          type: "openai-compatible";
          base_url: string | null;
          api_key_setting: string | null;
          is_enabled: boolean;
          supports_tools: boolean;
          supports_images: boolean;
          supports_streaming: boolean;
          extra_headers: Record<string, string>;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: "openai-compatible";
          base_url?: string | null;
          api_key_setting?: string | null;
          is_enabled?: boolean;
          supports_tools?: boolean;
          supports_images?: boolean;
          supports_streaming?: boolean;
          extra_headers?: Record<string, string>;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: "openai-compatible";
          base_url?: string | null;
          api_key_setting?: string | null;
          is_enabled?: boolean;
          supports_tools?: boolean;
          supports_images?: boolean;
          supports_streaming?: boolean;
          extra_headers?: Record<string, string>;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {};
    Functions: {
      get_app_setting: {
        Args: { setting_key: string };
        Returns: Array<{ value: string; is_encrypted: boolean }>;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Enums: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    CompositeTypes: {};
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Space = Database["public"]["Tables"]["spaces"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];
export type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];
export type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"];
export type WorkoutExercise = Database["public"]["Tables"]["workout_exercises"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type WorkoutLogExercise = Database["public"]["Tables"]["workout_log_exercises"]["Row"];
export type FocusSession = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalProgressLog = Database["public"]["Tables"]["goal_progress_logs"]["Row"];
export type WeeklyReview = Database["public"]["Tables"]["weekly_reviews"]["Row"];
export type DailyBriefing = Database["public"]["Tables"]["daily_briefings"]["Row"];
export type InsightCache = Database["public"]["Tables"]["insight_cache"]["Row"];
export type AppSetting = Database["public"]["Tables"]["app_settings"]["Row"];
export type AppModel = Database["public"]["Tables"]["app_models"]["Row"];
export type LLMProvider = Database["public"]["Tables"]["llm_providers"]["Row"];
