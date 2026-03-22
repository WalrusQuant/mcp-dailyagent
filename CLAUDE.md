# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal AI chatbot built with Next.js 16 and a multi-provider LLM layer (Anthropic, Google, OpenAI-compatible via OpenRouter). Features multi-model chat with agent/chat mode toggle, tool calling, image generation, web search with AI summarization, per-message usage/cost tracking, monthly budget enforcement, rate limiting, admin panel, collapsible sidebar, and Supabase for authentication and data persistence. Installable as a PWA with light/dark/system theme support.

## Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

Tests use Vitest + React Testing Library:

```bash
npm test             # Run all tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Test files live alongside source in `__tests__/` directories (e.g., `src/lib/__tests__/cost.test.ts`). The Supabase mock factory is at `src/test/mocks/supabase.ts`.

## Architecture

### Route Structure (Next.js App Router)

- `src/app/(auth)/` - Public auth routes (login, signup) - redirect to /chat if authenticated
- `src/app/(protected)/` - Protected routes (chat, image, settings, calendar, history) - redirect to /login if unauthenticated
- `src/app/api/` - API endpoints:
  - `chat/` - Chat streaming via multi-provider LLM router
  - `chat/tool-execute/` - Agent tool execution endpoint
  - `conversations/` - Conversations CRUD + per-conversation messages
  - `conversations/[id]/tags/` - Conversation tag management
  - `conversations/bulk-delete/` - Bulk conversation delete
  - `image/` - Image generation via LLM router
  - `models/` - Model list (public) + admin CRUD + `/raw` endpoint
  - `profile/` - User profile and settings (system prompt, search config)
  - `search/` - Conversation search
  - `messages/` - Full-text message search
  - `messages/save/` - Partial message save (streaming cancel)
  - `usage/` - Cumulative usage/cost tracking
  - `usage/stats/` - Usage statistics + budget tracking
  - `web-search/` - Tavily web search
  - `auth/` - Auth callback
  - `auth/signup/` - Signup with secret code
  - `tasks/` - Task CRUD + rollover + reorder (Franklin Covey priorities)
  - `tasks/rollover/check/` - Rollover availability check
  - `habits/` - Habit CRUD + log toggle + streaks/stats
  - `journal/` - Journal entry CRUD + full-text search + AI prompts
  - `workouts/` - Workout templates + logs + exercises + stats
  - `focus/` - Pomodoro focus sessions + stats
  - `goals/` - Goals CRUD + progress tracking + linked tasks/habits
  - `dashboard/` - Aggregated daily snapshot across all tools
  - `weekly-review/` - Weekly review CRUD + AI generation
  - `calendar/` - Calendar day detail + monthly aggregation
  - `images/` - Image storage/retrieval
  - `projects/` - Project CRUD
  - `tags/` - Tag management
  - `briefing/` - AI daily briefing generation
  - `insights/` - AI proactive insights analysis
  - `ai-assist/` - In-tool AI suggestions
  - `admin/limits/` - Usage limits CRUD
  - `admin/providers/` - LLM provider management
  - `admin/settings/` - App settings (API keys, encryption)
  - `admin/settings/test/` - Provider connection testing
  - `admin/usage/` - Admin usage overview
- `src/middleware.ts` - Auth middleware that controls route protection

### Data Flow

1. Client components send requests to API routes
2. API routes verify auth via Supabase server client
3. Chat requests stream through the LLM router (`src/lib/llm/router.ts`), which resolves the model to a provider and dispatches to the appropriate adapter (Anthropic, Google, or OpenAI-compatible)
4. Messages and conversations persist to Supabase with token counts and cost
5. Web search (Tavily) results are optionally summarized by a configurable search model before injection into the system prompt
6. AI-generated conversation titles via a fast model (TITLE_MODEL) after first response
7. Usage metadata is sent inline via `[[USAGE:...]]` pattern at end of stream, parsed client-side
8. Rate limiter enforces per-user, per-category request limits (chat, image, search, AI assist); admins bypass limits
9. Monthly budget and daily conversation limits are enforced server-side via `src/lib/usage-limits.ts`

### Key Files

- `src/lib/models.ts` - Model type definition and title model config. Models come from `app_models` DB table, not hardcoded.
- `src/lib/useModels.ts` - Client-side hook to fetch models from `/api/models` with in-memory caching
- `src/lib/llm/router.ts` - Multi-provider LLM router (resolves model to provider, dispatches to adapter)
- `src/lib/llm/types.ts` - Shared LLM types
- `src/lib/llm/adapters/anthropic.ts` - Native Anthropic SDK adapter
- `src/lib/llm/adapters/google.ts` - Native Google Generative AI adapter
- `src/lib/llm/adapters/openai-compatible.ts` - OpenAI-compatible adapter (OpenRouter, OpenAI, xAI)
- `src/lib/tools/definitions.ts` - Agent tool definitions (13 tools)
- `src/lib/tools/executor.ts` - Server-side tool execution engine
- `src/lib/enhanced-search.ts` - AI-summarized web search using configurable search model
- `src/lib/cost.ts` - Per-message cost calculation from token counts and model pricing
- `src/lib/system-prompt.ts` - Default system prompt (always applied unless user sets custom prompt)
- `src/lib/dates.ts` - Date utility functions
- `src/lib/productivity-context.ts` - Context injection data aggregation for AI
- `src/lib/theme.tsx` - ThemeProvider for light/dark/system theme
- `src/lib/tavily.ts` - Tavily web search client
- `src/lib/retry.ts` - Retry utility
- `src/lib/rate-limit.ts` - In-memory sliding window rate limiter (per user per category)
- `src/lib/usage-limits.ts` - Monthly budget + daily conversation limit enforcement
- `src/lib/encryption.ts` - AES-256-GCM encryption for stored API keys
- `src/lib/admin.ts` - Admin access helpers
- `src/lib/app-config.ts` - DB-first configuration with env var fallback + 5-min cache
- `src/lib/ai-models.ts` - Per-task model routing (briefing, insights, assist, tools)
- `src/lib/export.ts` - Markdown/JSON conversation export
- `src/lib/model-context.tsx` - React context for active model
- `src/lib/command-palette-context.tsx` - Command palette context
- `src/lib/focus-timer-context.tsx` - Persistent focus timer state context
- `src/lib/toast-context.tsx` - Toast notification context
- `src/lib/supabase/client.ts` - Client-side Supabase instance
- `src/lib/supabase/server.ts` - Server-side Supabase instance (uses cookies)
- `src/types/database.ts` - TypeScript types for all Supabase tables

### Components

- `src/components/Chat.tsx` - Main chat interface with streaming, sources, and usage display
- `src/components/Message.tsx` - Message rendering with react-markdown, syntax highlighting, citation linkification, sources toggle, and markdown normalization (fixes broken numbered lists)
- `src/components/ModelSelector.tsx` - Model selection popover
- `src/components/ImageGenerator.tsx` - Image generation interface
- `src/components/UsageBalance.tsx` - Sidebar cumulative usage display (fetches /api/usage)
- `src/components/UsageDisplay.tsx` - Per-message token/cost display
- `src/components/ToolCallCard.tsx` - Agent tool call approval UI
- `src/components/ComposerMenu.tsx` - Chat input menu (file attach, web search toggle)
- `src/components/ConversationSettings.tsx` - Per-conversation system prompt editor
- `src/components/ErrorBoundary.tsx` - Error boundary wrapper
- `src/components/FileUpload.tsx` - File/image attachment for chat
- `src/components/ProjectPicker.tsx` - Project selection for conversations
- `src/components/TagPicker.tsx` - Tag management for conversations
- `src/components/layout/Sidebar.tsx` - Collapsible sidebar with conversation list, search, date grouping, nav links, collapsible Tools group, and theme toggle
- `src/components/layout/ProtectedLayoutClient.tsx` - Layout wrapper managing sidebar state (open/close, collapsed/expanded)
- `src/components/layout/BottomNav.tsx` - Mobile bottom navigation bar
- `src/components/calendar/` - CalendarView, CalendarGrid, CalendarDayCell, DayDetailPanel
- `src/components/history/` - ChatHistory with search, bulk delete, infinite scroll
- `src/components/auth/AuthForm.tsx` - Login/signup form with remember email feature
- `src/components/shared/` - Reusable components: DateNavigation, StatCard, EmptyState, SparklineChart, FormModal, CommandPalette, Skeleton, Toast
- `src/components/tasks/` - TaskList, TaskItem, TaskFormModal, TaskRolloverBanner
- `src/components/habits/` - HabitTracker, HabitRow, HabitFormModal
- `src/components/journal/` - JournalView, JournalEditor, JournalEntryCard
- `src/components/workouts/` - WorkoutDashboard, WorkoutLogger, WorkoutLogCard, TemplateFormModal, ExerciseSetInput
- `src/components/focus/` - FocusTimer, TimerDisplay, FocusStats, FocusTimerBadge
- `src/components/goals/` - GoalList, GoalItem, GoalDetail, GoalFormModal, GoalPicker
- `src/components/dashboard/` - Dashboard + TaskWidget, HabitWidget, JournalWidget, WorkoutWidget, FocusWidget, GoalWidget, DailyBriefing, DailyStartCard, InsightCards
- `src/components/projects/` - ProjectDashboard, ProjectFormModal, ProjectsList, ProjectFileUpload
- `src/components/search/` - SearchModal, SearchResult (full-text conversation search)
- `src/components/usage/` - UsageDashboard, BudgetAlert, BudgetSettings, ModelBreakdown, SpendingChart, TokenChart
- `src/components/review/` - WeeklyReview

### UI Design

- CSS variables defined in `globals.css` for light/dark themes
- All components use `style={{ color: "var(--text-primary)" }}` pattern for theming
- Claude-inspired design: warm accent color (#d4a574 dark / #b8845a light), no avatars, pill-shaped inputs
- Auto-create conversation on first message from `/chat`
- Suggested prompt chips on empty state
- Collapsible sidebar: full width (280px) or icon-only (60px) on desktop, hidden on mobile (uses BottomNav instead)
- Mobile: bottom navigation bar with safe area insets for PWA
- iOS PWA viewport fix: uses `screen.height` on initial standalone load, `innerHeight` on resize

### Database Schema (Supabase)

- `profiles` - User profiles with system_prompt, search_model, search_results_basic/advanced, ai_model_config settings
- `conversations` - Chat conversations with model selection
- `messages` - Individual messages with role, token counts (prompt_tokens, completion_tokens), total_cost, and sources
- `generated_images` - Stored image generation results
- `app_models` - Admin-managed model definitions (model_id, name, provider, type, pricing, is_default, sort_order)
- `projects` - Projects with system prompts and status
- `tags` + `conversation_tags` - Tag system for conversations
- `tasks` - Task manager with Franklin Covey A/B/C priorities, recurrence, rollover, project linking
- `habits` + `habit_logs` - Habit tracking with target days, streaks, completion rates
- `journal_entries` - Daily journal with mood tracking and full-text search
- `workout_templates` + `workout_exercises` - Reusable workout templates with exercises
- `workout_logs` + `workout_log_exercises` - Logged workouts with sets (JSONB)
- `focus_sessions` - Pomodoro timer sessions linked to tasks
- `goals` - Goals with progress tracking, target dates, linked tasks and habits
- `weekly_reviews` - AI-generated weekly review summaries
- `daily_briefings` - Cached AI daily briefings
- `insight_cache` - Cached AI proactive insights
- `ai_model_config` - Per-task AI model configuration
- `ai_feature_toggles` - Feature toggle settings per user
- `usage_limits` - Admin-configured per-user usage limits

### Migrations

Single consolidated schema file: `supabase/migrations/schema.sql`
- Run the entire file in Supabase SQL Editor to set up the database
- Contains all tables, indexes, RLS policies, triggers, and storage buckets

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SIGNUP_SECRET` - Secret code for account creation

Provider API keys (Anthropic, Google, OpenAI, OpenRouter) are configured from the Admin panel and stored encrypted in the database — not in environment variables.

Optional:
- `DEFAULT_CHAT_MODEL` - Default chat model ID (default: `anthropic/claude-sonnet-4.5`)
- `DEFAULT_IMAGE_MODEL` - Default image model ID (default: `google/gemini-2.5-flash-image`)
- `TITLE_MODEL` - Model for generating conversation titles (default: `google/gemini-3-flash-preview`)
- `TAVILY_API_KEY` - Tavily API key for web search
- `ENCRYPTION_KEY` - Required for the admin settings feature (encrypts provider API keys stored in DB)
- `NEXT_PUBLIC_SITE_NAME` - App name shown in UI and meta tags (default: `Daily Agent`)
- `NEXT_PUBLIC_SITE_DESCRIPTION` - Meta description (default: `Your AI productivity agent`)

## Tech Stack

- Next.js 16 with App Router (Turbopack)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase (auth + PostgreSQL)
- Multi-provider LLM (Anthropic SDK, Google Generative AI, OpenAI-compatible)
- Tavily (web search)
- Lucide React (icons)
- react-markdown + rehype-highlight + remark-gfm
- Vitest + React Testing Library (testing)
- PWA (manifest + service worker)
