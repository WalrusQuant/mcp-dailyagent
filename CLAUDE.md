# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Self-hosted, single-user MCP server + productivity dashboard. Runs in Docker on a VPS alongside OpenClaw. The MCP server exposes tasks, habits, journal, workouts, focus, goals, and weekly reviews to Claude so it can read and write your productivity data directly. The dashboard is a visual UI over the same data.

**Not a SaaS.** No multi-tenant, no signup, no billing, no OAuth. One user (you), one API key from `.env`, one deployment. Open-source because why not.

**Status:** Mid-pivot from SaaS. See "Current state" below — multi-tenant/billing/OAuth infra is fully ripped out (commit `34ab232` on `pivot-self-hosted-rip`). Next work: swap Supabase for local Postgres, wire Docker Compose for VPS deploy.

## Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
npm test         # Run all tests once (Vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

Test files live alongside source in `__tests__/` directories.

## Architecture

### Route Structure (Next.js App Router)

- `src/app/(auth)/login/` — Login page (single-user, no signup)
- `src/app/(protected)/` — Dashboard and productivity tools: `dashboard`, `tasks`, `habits`, `journal`, `workouts`, `focus`, `goals`, `calendar`, `review`, `projects`, `settings`, `admin`
- `src/app/api/` — API endpoints:
  - `mcp/` — **MCP server endpoint** (Streamable HTTP, stateless, Bearer auth)
  - `tasks/` — Task CRUD + rollover + reorder (Franklin Covey A/B/C priorities)
  - `habits/` — Habit CRUD + log toggle + streaks/stats
  - `journal/` — Journal entry CRUD + full-text search + AI prompts
  - `workouts/` — Workout templates + logs + exercises + stats
  - `focus/` — Pomodoro focus sessions + stats
  - `goals/` — Goals CRUD + progress tracking
  - `dashboard/` — Aggregated daily snapshot
  - `weekly-review/` — Weekly review CRUD + AI generation
  - `calendar/` — Calendar day detail + monthly aggregation
  - `projects/` — "Spaces" (areas of life that group tasks/goals/habits)
  - `tags/` — Tag management
  - `briefing/` — AI daily briefing generation
  - `insights/` — AI proactive insights analysis
  - `profile/` — User profile
  - `auth/callback/` — Supabase auth callback
  - `admin/providers/` — LLM provider management (OpenRouter config)
  - `admin/settings/` — App settings (OpenRouter key, encrypted)
- `src/middleware.ts` — Auth middleware (Supabase session check on protected routes)

### MCP Server

The MCP server is the core artifact. Located at `/api/mcp`, it uses the official `@modelcontextprotocol/sdk` with Streamable HTTP transport. Stateless — each request is auth'd independently.

**Auth:** Bearer token must exactly match `MCP_API_KEY` env var. User ID is `SELF_HOSTED_USER_ID` env var. All requests get full scopes (`all` → expanded via `src/lib/oauth-scopes.ts`). No OAuth, no DB-backed keys, no plan gating, no per-user rate limits.

**Layout** (`src/lib/mcp/`):
- `server.ts` — MCP server factory; registers tools, resources, prompts
- `auth.ts` — Request authentication
- `types.ts` — Shared types (`McpContext`, `QueryResult`)
- `supabase.ts` — Service-role Supabase client for MCP handlers
- `tools/` — Write and read tools (tasks, habits, journal, workouts, focus, goals, spaces, reviews)
- `resources/` — Read-only resource URIs (`dailyagent://...`)
- `prompts/` — Pre-built prompt templates (daily planning, weekly review, habit analysis, etc.)
- `queries/` — Shared DB query helpers
- `tools/helpers.ts` — `getAuth`, `checkScope`, `textResult`, `errorResult`, `NOT_AUTHENTICATED`

**How cron works:** OpenClaw schedules a message like "call the `morning_briefing` MCP prompt." Claude then calls the MCP tools to read state and writes the briefing back via `generate_daily_briefing`. The MCP server itself doesn't run cron.

### Data Flow

1. Client components hit API routes (protected by Supabase session)
2. MCP clients hit `/api/mcp` with `Authorization: Bearer <MCP_API_KEY>`
3. Both paths write to the same Supabase tables — one data layer, two interfaces
4. AI-generated content (briefings, reviews, insights) follows last-write-wins — dashboard and MCP can overwrite each other's output
5. House-model AI features (briefings/insights/journal prompts/weekly reviews) hit OpenRouter via the admin-configured key

### Key Files

- `src/lib/llm/router.ts` — OpenAI-compatible adapter router (OpenRouter-only in practice)
- `src/lib/llm/adapters/openai-compatible.ts` — The one LLM adapter
- `src/lib/dates.ts` — Date utility functions
- `src/lib/productivity-context.ts` — Data aggregation for AI context
- `src/lib/theme.tsx` — ThemeProvider (light/dark/system)
- `src/lib/retry.ts` — Retry utility
- `src/lib/rate-limit.ts` — In-memory sliding window rate limiter (used only for dashboard AI features: briefing, insights, journal prompts, weekly review)
- `src/lib/encryption.ts` — AES-256-GCM encryption for stored OpenRouter API key
- `src/lib/admin.ts` — Admin access helpers
- `src/lib/app-config.ts` — DB-first config with env fallback + 5-min cache
- `src/lib/ai-models.ts` — Per-task AI model routing
- `src/lib/token-validation.ts` — MCP bearer-token validation against `MCP_API_KEY` env var
- `src/lib/oauth-scopes.ts` — Scope expansion (`all` → individual scopes)
- `src/lib/supabase/client.ts` — Client-side Supabase
- `src/lib/supabase/server.ts` — Server-side Supabase (reads cookies)
- `src/types/database.ts` — TypeScript types for Supabase tables

### Components

- `src/components/layout/Sidebar.tsx` — Collapsible sidebar with nav, theme toggle
- `src/components/layout/ProtectedLayoutClient.tsx` — Layout wrapper (sidebar state)
- `src/components/layout/BottomNav.tsx` — Mobile bottom nav
- `src/components/auth/AuthForm.tsx` — Login form with remember-email
- `src/components/settings/` — `Settings`, `AccountTab`, `PreferencesTab`, `DangerZoneTab`
- `src/components/dashboard/` — `Dashboard` + widgets (`TaskWidget`, `HabitWidget`, `JournalWidget`, `WorkoutWidget`, `FocusWidget`, `GoalWidget`, `DailyBriefing`, `DailyStartCard`, `InsightCards`)
- `src/components/tasks/`, `habits/`, `journal/`, `workouts/`, `focus/`, `goals/`, `calendar/`, `review/`, `projects/` — Per-tool UI
- `src/components/shared/` — Reusable: `DateNavigation`, `StatCard`, `EmptyState`, `SparklineChart`, `FormModal`, `CommandPalette`, `Skeleton`, `Toast`
- `src/components/ErrorBoundary.tsx` — Error boundary wrapper

### UI Design

- CSS variables in `globals.css` for light/dark themes
- Theming via `style={{ color: "var(--text-primary)" }}` — no Tailwind color classes for text
- Warm accent color (#d4a574 dark / #b8845a light)
- Collapsible sidebar: 280px full / 60px icon-only on desktop, hidden on mobile (BottomNav instead)
- PWA with iOS viewport fix (`screen.height` on initial standalone load, `innerHeight` on resize)

### Database Schema (Supabase)

Single consolidated schema file: `supabase/schema.sql`. Run the entire file in Supabase SQL Editor to set up.

Tables:
- `profiles` — User profile (single row in practice); no billing columns
- `spaces` — Areas of life that group tasks/goals/habits (renamed from "projects")
- `tags` — User-defined tags
- `tasks` — Franklin Covey A/B/C priorities, recurrence, rollover, space/goal linking
- `habits` + `habit_logs` — Habit tracking with target days, streaks, completion rates
- `journal_entries` — Daily journal with mood + full-text search
- `workout_templates` + `workout_exercises` — Reusable workout templates
- `workout_logs` + `workout_log_exercises` — Logged workouts with sets (JSONB)
- `focus_sessions` — Pomodoro timer sessions linked to tasks
- `goals` + `goal_progress_logs` — Goals with progress tracking
- `weekly_reviews` — Weekly review summaries (source: dashboard | mcp)
- `daily_briefings` — Cached daily briefings (source: dashboard | mcp)
- `insight_cache` — Cached proactive insights (source: dashboard | mcp)
- `app_settings` — Admin key/value store (OpenRouter key encrypted here)
- `app_models` — Admin-managed AI model list
- `llm_providers` — LLM provider config (OpenRouter seeded)

No migration history — fresh schema per deploy.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (used by MCP for DB access)
- `MCP_API_KEY` — Bearer token the MCP client must send (generate a long random string)
- `SELF_HOSTED_USER_ID` — The one user's Supabase `auth.users.id` (UUID)
- `ENCRYPTION_KEY` — AES-256 key for encrypting OpenRouter key in `app_settings`

Optional:
- `NEXT_PUBLIC_SITE_NAME` — App name (default: `Daily Agent`)
- `NEXT_PUBLIC_SITE_DESCRIPTION` — Meta description

OpenRouter API key is set from the admin panel (`/admin`) and stored encrypted in `app_settings` — not an env var.

## Current state (2026-04-19)

- ✅ Phase 1 — Codebase cleanup (chat/image/search stripped)
- ✅ Phase 2 — Fresh DB schema
- ✅ Phase 3 — Multi-tenant auth → **ripped for self-hosted pivot**
- ✅ Phase 4 — API key CRUD → **ripped, swapped for env var**
- ✅ Phase 5 — Ory Hydra OAuth → **ripped entirely**
- ✅ Phase 6 — MCP server (15 resources, 31 tools, 13 prompts) — **keep**
- ✅ Self-hosted rip — 50 files changed, 4065 lines deleted (commit `34ab232`)

**Next up:**
1. Swap Supabase for self-hosted Postgres container
2. `docker-compose.yml` for VPS deploy
3. Reverse proxy / Tailscale access for dashboard
4. OpenClaw MCP connection snippet

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript 5
- Tailwind CSS 4
- Supabase (auth + Postgres — temporary, being swapped for local Postgres)
- OpenAI SDK (OpenRouter-compatible)
- `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- Lucide React (icons)
- Vitest + React Testing Library
- PWA (manifest + service worker)
