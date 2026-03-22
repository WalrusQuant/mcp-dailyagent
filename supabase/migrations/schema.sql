-- =============================================================================
-- Full Database Schema
-- Run this entire file in Supabase SQL Editor to set up the database.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  system_prompt TEXT DEFAULT NULL,
  search_model TEXT DEFAULT NULL,
  search_results_basic INTEGER DEFAULT 10,
  search_results_advanced INTEGER DEFAULT 20,
  context_injection BOOLEAN NOT NULL DEFAULT true,
  ai_model_config JSONB DEFAULT NULL,
  tool_calling_enabled BOOLEAN NOT NULL DEFAULT true,
  briefing_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_budget NUMERIC DEFAULT NULL,
  memory_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Projects
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  system_prompt TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(user_id, status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Project Files
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_files_project_id ON public.project_files(project_id);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project files" ON public.project_files
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upload own project files" ON public.project_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own project files" ON public.project_files
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload project files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'project-files' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own project files storage" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'project-files' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own project files storage" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'project-files' AND
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 4. Tags
-- ---------------------------------------------------------------------------
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_project_id ON public.conversations(project_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Conversation Tags
-- ---------------------------------------------------------------------------
CREATE TABLE public.conversation_tags (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, tag_id)
);

CREATE INDEX idx_conversation_tags_tag_id ON public.conversation_tags(tag_id);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation tags" ON public.conversation_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can add tags to own conversations" ON public.conversation_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can remove tags from own conversations" ON public.conversation_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  original_content TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_cost NUMERIC,
  sources JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_search ON public.messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own conversations"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Generated Images
-- ---------------------------------------------------------------------------
CREATE TABLE public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash-image',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_images_user_id ON public.generated_images(user_id);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images"
  ON public.generated_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own images"
  ON public.generated_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own images"
  ON public.generated_images FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Helper: Admin check function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 9. App Models
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('chat', 'image')),
  context_length INTEGER,
  pricing_prompt NUMERIC,
  pricing_completion NUMERIC,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_models_type ON public.app_models(type);
CREATE UNIQUE INDEX idx_app_models_unique_model ON public.app_models(model_id, type);

ALTER TABLE public.app_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read models"
  ON public.app_models FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert models"
  ON public.app_models FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update models"
  ON public.app_models FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete models"
  ON public.app_models FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. Tasks
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'B1' CHECK (priority ~ '^[A-C][1-9]$'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rolled_from UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  recurrence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_date ON public.tasks(user_id, task_date);
CREATE INDEX idx_tasks_user_done ON public.tasks(user_id, done);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Atomic task reorder function
CREATE OR REPLACE FUNCTION public.reorder_tasks(task_ids UUID[], sort_orders INT[], p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  FOR i IN 1..array_length(task_ids, 1) LOOP
    UPDATE public.tasks SET sort_order = sort_orders[i], updated_at = NOW()
    WHERE id = task_ids[i] AND user_id = p_user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 11. Habits
-- ---------------------------------------------------------------------------
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  target_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
  color TEXT NOT NULL DEFAULT '#d4a574',
  archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, log_date)
);

CREATE INDEX idx_habits_user ON public.habits(user_id);
CREATE INDEX idx_habit_logs_habit_date ON public.habit_logs(habit_id, log_date);
CREATE INDEX idx_habit_logs_user_date ON public.habit_logs(user_id, log_date);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own habits" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit logs" ON public.habit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own habit logs" ON public.habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own habit logs" ON public.habit_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 12. Journal
-- ---------------------------------------------------------------------------
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_user_date ON public.journal_entries(user_id, entry_date);
CREATE INDEX idx_journal_search ON public.journal_entries USING gin(to_tsvector('english', content));

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own journal entries" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal entries" ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal entries" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 13. Workouts
-- ---------------------------------------------------------------------------
CREATE TABLE public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'strength' CHECK (exercise_type IN ('strength', 'timed', 'cardio')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  default_weight NUMERIC,
  default_duration INTEGER,
  notes TEXT
);

CREATE TABLE public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_log_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'strength',
  sort_order INTEGER NOT NULL DEFAULT 0,
  sets JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_workout_templates_user ON public.workout_templates(user_id);
CREATE INDEX idx_workout_exercises_template ON public.workout_exercises(template_id);
CREATE INDEX idx_workout_logs_user_date ON public.workout_logs(user_id, log_date);
CREATE INDEX idx_workout_log_exercises_log ON public.workout_log_exercises(log_id);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own templates" ON public.workout_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.workout_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.workout_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.workout_templates
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own template exercises" ON public.workout_exercises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workout_templates WHERE id = template_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create own template exercises" ON public.workout_exercises
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.workout_templates WHERE id = template_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update own template exercises" ON public.workout_exercises
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.workout_templates WHERE id = template_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete own template exercises" ON public.workout_exercises
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.workout_templates WHERE id = template_id AND user_id = auth.uid())
  );

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workout logs" ON public.workout_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workout logs" ON public.workout_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workout logs" ON public.workout_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workout logs" ON public.workout_logs
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.workout_log_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own log exercises" ON public.workout_log_exercises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create own log exercises" ON public.workout_log_exercises
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update own log exercises" ON public.workout_log_exercises
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete own log exercises" ON public.workout_log_exercises
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.workout_logs WHERE id = log_id AND user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 14. Focus Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  break_minutes INTEGER NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT
);

CREATE INDEX idx_focus_sessions_user ON public.focus_sessions(user_id);
CREATE INDEX idx_focus_sessions_user_date ON public.focus_sessions(user_id, started_at);
CREATE INDEX idx_focus_sessions_task ON public.focus_sessions(task_id);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus sessions" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own focus sessions" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus sessions" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own focus sessions" ON public.focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 15. Weekly Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_reviews_user ON public.weekly_reviews(user_id);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly reviews" ON public.weekly_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own weekly reviews" ON public.weekly_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly reviews" ON public.weekly_reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly reviews" ON public.weekly_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 16. Daily Briefings
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, briefing_date)
);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own briefings" ON public.daily_briefings
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 17. Insight Cache
-- ---------------------------------------------------------------------------
CREATE TABLE public.insight_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cache_date DATE NOT NULL DEFAULT CURRENT_DATE,
  insights JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, cache_date)
);

ALTER TABLE public.insight_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own insights" ON public.insight_cache
  FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 18. Goals
-- ---------------------------------------------------------------------------
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('health', 'career', 'personal', 'financial', 'learning', 'relationships', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  progress_mode TEXT NOT NULL DEFAULT 'auto' CHECK (progress_mode IN ('auto', 'manual')),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user_status ON public.goals(user_id, status);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 19. Goal Progress Logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.goal_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  UNIQUE(goal_id, log_date)
);

CREATE INDEX idx_goal_progress_logs_user_date ON public.goal_progress_logs(user_id, log_date);

ALTER TABLE public.goal_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal progress logs" ON public.goal_progress_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own goal progress logs" ON public.goal_progress_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal progress logs" ON public.goal_progress_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal progress logs" ON public.goal_progress_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 20. Add goal_id to tasks and habits
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks ADD COLUMN goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_goal ON public.tasks(goal_id);

ALTER TABLE public.habits ADD COLUMN goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
CREATE INDEX idx_habits_goal ON public.habits(goal_id);

-- ===========================================================================
-- 018: App Settings — database-driven configuration
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete settings" ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_app_setting(setting_key TEXT)
RETURNS TABLE(value TEXT, is_encrypted BOOLEAN) AS $$
  SELECT value, is_encrypted FROM public.app_settings WHERE key = setting_key;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===========================================================================
-- 019: LLM Providers — multi-provider support
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.llm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('openai-compatible', 'anthropic', 'google')),
  base_url TEXT,
  api_key_setting TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  supports_tools BOOLEAN NOT NULL DEFAULT true,
  supports_images BOOLEAN NOT NULL DEFAULT false,
  supports_streaming BOOLEAN NOT NULL DEFAULT true,
  extra_headers JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read providers"
  ON public.llm_providers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage providers"
  ON public.llm_providers FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_llm_providers_is_enabled ON public.llm_providers(is_enabled);

-- Add provider_id and api_model_id to app_models
ALTER TABLE public.app_models ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.llm_providers(id) ON DELETE SET NULL;
ALTER TABLE public.app_models ADD COLUMN IF NOT EXISTS api_model_id TEXT;

CREATE INDEX IF NOT EXISTS idx_app_models_provider_id ON public.app_models(provider_id);

-- Seed default OpenRouter provider
INSERT INTO public.llm_providers (id, name, type, base_url, api_key_setting, is_enabled, supports_tools, supports_images, supports_streaming, extra_headers, sort_order)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'OpenRouter',
  'openai-compatible',
  'https://openrouter.ai/api/v1',
  'openrouter_api_key',
  true, true, true, true, '{}', 0
) ON CONFLICT (id) DO NOTHING;

-- Backfill existing models to point at OpenRouter
UPDATE public.app_models SET provider_id = '00000000-0000-0000-0000-000000000001' WHERE provider_id IS NULL;

-- ── Usage Limits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('cost', 'tokens')),
  limit_value NUMERIC NOT NULL CHECK (limit_value > 0),
  period TEXT NOT NULL CHECK (period IN ('daily', 'monthly')),
  mode TEXT NOT NULL DEFAULT 'hard' CHECK (mode IN ('hard', 'soft')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_limits_user ON public.usage_limits(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_limits_unique
  ON public.usage_limits(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), limit_type, period);

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage usage_limits"
  ON public.usage_limits FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
