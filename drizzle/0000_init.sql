CREATE TABLE "app_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'openrouter' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"provider_id" uuid,
	"api_model_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "app_models_type_check" CHECK ("app_models"."type" IN ('chat', 'image'))
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "daily_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"briefing_date" date DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "daily_briefings_source_check" CHECK ("daily_briefings"."source" IN ('dashboard', 'mcp'))
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"duration_minutes" integer DEFAULT 25 NOT NULL,
	"break_minutes" integer DEFAULT 5 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	CONSTRAINT "focus_sessions_status_check" CHECK ("focus_sessions"."status" IN ('active', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "goal_progress_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"log_date" date DEFAULT now() NOT NULL,
	"progress" integer NOT NULL,
	CONSTRAINT "goal_progress_logs_progress_check" CHECK ("goal_progress_logs"."progress" >= 0 AND "goal_progress_logs"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'personal' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_mode" text DEFAULT 'auto' NOT NULL,
	"target_date" date,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_category_check" CHECK ("goals"."category" IN ('health', 'career', 'personal', 'financial', 'learning', 'relationships', 'other')),
	CONSTRAINT "goals_status_check" CHECK ("goals"."status" IN ('active', 'completed', 'abandoned')),
	CONSTRAINT "goals_progress_check" CHECK ("goals"."progress" >= 0 AND "goals"."progress" <= 100),
	CONSTRAINT "goals_progress_mode_check" CHECK ("goals"."progress_mode" IN ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"target_days" integer[] DEFAULT '{1,2,3,4,5,6,7}',
	"color" text DEFAULT '#d4a574' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"goal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habits_frequency_check" CHECK ("habits"."frequency" IN ('daily', 'weekly'))
);
--> statement-breakpoint
CREATE TABLE "insight_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cache_date" date DEFAULT now() NOT NULL,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "insight_cache_source_check" CHECK ("insight_cache"."source" IN ('dashboard', 'mcp'))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"mood" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_mood_check" CHECK ("journal_entries"."mood" >= 1 AND "journal_entries"."mood" <= 5)
);
--> statement-breakpoint
CREATE TABLE "llm_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"base_url" text,
	"api_key_setting" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"supports_tools" boolean DEFAULT true NOT NULL,
	"supports_streaming" boolean DEFAULT true NOT NULL,
	"extra_headers" jsonb DEFAULT '{}'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_providers_type_check" CHECK ("llm_providers"."type" IN ('openai-compatible'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC',
	"is_admin" boolean DEFAULT false NOT NULL,
	"ai_model_config" jsonb,
	"tool_calling_enabled" boolean DEFAULT true NOT NULL,
	"briefing_enabled" boolean DEFAULT true NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_status_check" CHECK ("spaces"."status" IN ('active', 'paused', 'completed')),
	CONSTRAINT "spaces_progress_check" CHECK ("spaces"."progress" >= 0 AND "spaces"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"priority" text DEFAULT 'B1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"task_date" date DEFAULT now() NOT NULL,
	"rolled_from" uuid,
	"space_id" uuid,
	"goal_id" uuid,
	"recurrence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" ~ '^[A-C][1-9]$')
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reviews_source_check" CHECK ("weekly_reviews"."source" IN ('dashboard', 'mcp'))
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"exercise_type" text DEFAULT 'strength' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_sets" integer DEFAULT 3,
	"default_reps" integer DEFAULT 10,
	"default_weight" numeric,
	"default_duration" integer,
	"notes" text,
	CONSTRAINT "workout_exercises_type_check" CHECK ("workout_exercises"."exercise_type" IN ('strength', 'timed', 'cardio'))
);
--> statement-breakpoint
CREATE TABLE "workout_log_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"exercise_name" text NOT NULL,
	"exercise_type" text DEFAULT 'strength' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"name" text NOT NULL,
	"log_date" date DEFAULT now() NOT NULL,
	"duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_models" ADD CONSTRAINT "app_models_provider_id_llm_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."llm_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefings" ADD CONSTRAINT "daily_briefings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress_logs" ADD CONSTRAINT "goal_progress_logs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress_logs" ADD CONSTRAINT "goal_progress_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_cache" ADD CONSTRAINT "insight_cache_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rolled_from_tasks_id_fk" FOREIGN KEY ("rolled_from") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_log_exercises" ADD CONSTRAINT "workout_log_exercises_log_id_workout_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_models_type" ON "app_models" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefings_user_date_unique" ON "daily_briefings" USING btree ("user_id","briefing_date");--> statement-breakpoint
CREATE INDEX "idx_focus_sessions_user" ON "focus_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_focus_sessions_user_date" ON "focus_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_focus_sessions_task" ON "focus_sessions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_goal_progress_logs_user_date" ON "goal_progress_logs" USING btree ("user_id","log_date");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_progress_logs_goal_date_unique" ON "goal_progress_logs" USING btree ("goal_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_goals_user_status" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_habit_logs_habit_date" ON "habit_logs" USING btree ("habit_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_habit_logs_user_date" ON "habit_logs" USING btree ("user_id","log_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_logs_habit_date_unique" ON "habit_logs" USING btree ("habit_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_habits_user" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_habits_goal" ON "habits" USING btree ("goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_cache_user_date_unique" ON "insight_cache" USING btree ("user_id","cache_date");--> statement-breakpoint
CREATE INDEX "idx_journal_user_date" ON "journal_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "idx_journal_search" ON "journal_entries" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "idx_llm_providers_enabled" ON "llm_providers" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_spaces_user" ON "spaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_user_status" ON "spaces" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_unique" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_date" ON "tasks" USING btree ("user_id","task_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_done" ON "tasks" USING btree ("user_id","done");--> statement-breakpoint
CREATE INDEX "idx_tasks_space" ON "tasks" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_goal" ON "tasks" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_reviews_user" ON "weekly_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_user_week_unique" ON "weekly_reviews" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_workout_exercises_template" ON "workout_exercises" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_workout_log_exercises_log" ON "workout_log_exercises" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_user_date" ON "workout_logs" USING btree ("user_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_workout_templates_user" ON "workout_templates" USING btree ("user_id");