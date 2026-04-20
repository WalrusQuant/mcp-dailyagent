# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Hardened data layer for the user's OpenClaw agent.**

The user already tracks tasks/habits/journal/etc. via OpenClaw skills using markdown templates + scripts. This project replaces that fragile setup with a proper Postgres DB behind a typed MCP interface.

- **MCP server** (this repo) — Postgres + `/api/mcp` typed read/write tools + prompt templates. Stores data. Exposes it. Knows nothing about AI.
- **OpenClaw agent** — lives on the user's Mac, runs whatever model the user has configured (**model-agnostic — do NOT assume Claude**), has its own scheduler, bridges to Telegram/WhatsApp/etc. Calls MCP tools to read/write. Generates briefings/reviews/insights and saves them back via MCP write tools.
- **Dashboard** (this repo) — Next.js UI. Viewer + manual editor for the DB. No AI. No generate buttons. If you want AI, you talk to OpenClaw.

Two front doors (OpenClaw agent + dashboard), one DB. Dashboard access is gated by Tailscale (no app-level auth). MCP endpoint is protected by a single bearer token (`MCP_API_KEY`).

## Commands

```bash
npm run dev         # Next.js dev server (Turbopack)
npm run build       # Production build
npm start           # Start production server
npm run lint        # ESLint
npm test            # Vitest once
npm run test:watch  # Vitest watch
npm run db:generate # Generate Drizzle migration from schema diff
npm run db:migrate  # Apply migrations
npm run db:push     # Push schema directly (dev only)
npm run db:studio   # Drizzle studio UI
```

Test files live alongside source in `__tests__/` directories.

## Architecture

### Route Structure (Next.js App Router)

- `src/app/(protected)/` — Dashboard UI: `dashboard`, `tasks`, `habits`, `journal`, `workouts`, `focus`, `goals`, `calendar`, `review`, `spaces`, `settings`. No login — Tailscale gates access.
- `src/app/api/` — API endpoints:
  - `mcp/` — **MCP server endpoint** (Streamable HTTP, stateless, Bearer auth)
  - `tasks/`, `habits/`, `journal/`, `workouts/`, `focus/`, `goals/`, `spaces/`, `tags/`, `calendar/`, `dashboard/` — CRUD for the dashboard
  - `briefing/`, `insights/` — **GET-only**; reads what OpenClaw saved
  - `weekly-review/` — CRUD; no AI generation (user writes manually or OpenClaw writes via MCP)
  - `profile/` — single user's profile
  - `wipe-data/` — Danger Zone nuke button

### MCP Server

Located at `/api/mcp`. Uses the official `@modelcontextprotocol/sdk` with Streamable HTTP transport. Stateless — each request auth'd independently.

**Auth:** Bearer token must match `MCP_API_KEY`. User ID is `SELF_HOSTED_USER_ID` env var. Every request gets full scopes (`all` → expanded via `src/lib/oauth-scopes.ts`).

**Layout** (`src/lib/mcp/`):
- `server.ts` — MCP server factory; registers tools, resources, prompts
- `auth.ts` — Request authentication
- `types.ts` — Shared types (`McpContext`, `QueryResult`)
- `db.ts` — Re-exports Drizzle instance
- `tools/` — Read + write tools (tasks, habits, journal, workouts, focus, goals, spaces, reviews, briefings, **insights**, calendar)
- `resources/` — Read-only resource URIs (`dailyagent://...`)
- `prompts/` — Versioned prompt templates (daily planning, morning briefing, weekly review, habit analysis, productivity report, weekly trends, journal prompt, workout suggestion, goal planning, space planning, etc.). **OpenClaw calls these** — they replace the markdown templates that used to live in OpenClaw skills.
- `queries/` — Shared DB query helpers
- `tools/helpers.ts` — `getAuth`, `checkScope`, `textResult`, `errorResult`, `NOT_AUTHENTICATED`

**How cron works:** OpenClaw has its own scheduler. It fires a task like "do the morning briefing" at 7am, which calls the `morning_briefing` MCP prompt → OpenClaw's LLM reads the returned template + data → generates text → calls `save_daily_briefing` MCP tool to persist → delivers to Telegram. The MCP server itself doesn't run cron, doesn't call an LLM.

### Data Flow

1. **OpenClaw → MCP.** Reads/writes productivity data via `/api/mcp` with `Authorization: Bearer <MCP_API_KEY>`.
2. **Dashboard → API routes → Drizzle → Postgres.** CRUD for all data types. No AI calls.
3. **Dashboard reads what OpenClaw saves.** `daily_briefings`, `weekly_reviews`, `insight_cache` are written by OpenClaw via MCP save tools, displayed read-only in dashboard widgets.
4. **Same DB, two interfaces.** Last-write-wins on shared tables.

### Key Files

- `src/lib/db/client.ts` — Drizzle + postgres.js client (lazy-init so build doesn't need DATABASE_URL)
- `src/lib/db/schema.ts` — All table defs
- `src/lib/auth.ts` — `getUserId()` reading `SELF_HOSTED_USER_ID`
- `src/lib/admin.ts` — Admin access helpers (single-user: always true)
- `src/lib/dates.ts` — Date utilities
- `src/lib/theme.tsx` — ThemeProvider (light/dark/system)
- `src/lib/retry.ts` — Retry utility
- `src/lib/token-validation.ts` — MCP bearer-token validation
- `src/lib/oauth-scopes.ts` — Scope list + `all` expansion
- `src/types/database.ts` — Legacy TS types still imported by some UI components (harmless; will be regenerated from Drizzle later)

### Components

- `src/components/layout/Sidebar.tsx` — Collapsible sidebar with nav + theme toggle (no logout, no admin link)
- `src/components/layout/ProtectedLayoutClient.tsx` — Layout wrapper
- `src/components/layout/BottomNav.tsx` — Mobile bottom nav
- `src/components/settings/` — `Settings`, `AccountTab`, `PreferencesTab`, `DangerZoneTab` (with "Wipe All Data")
- `src/components/dashboard/` — `Dashboard` + widgets (`TaskWidget`, `HabitWidget`, `JournalWidget`, `WorkoutWidget`, `FocusWidget`, `GoalWidget`, `DailyBriefing` (read-only), `DailyStartCard`, `InsightCards` (read-only))
- `src/components/tasks/`, `habits/`, `journal/`, `workouts/`, `focus/`, `goals/`, `calendar/`, `review/`, `spaces/` — Per-tool UI
- `src/components/shared/` — Reusable: `DateNavigation`, `StatCard`, `EmptyState`, `SparklineChart`, `FormModal`, `CommandPalette`, `Skeleton`, `Toast`
- `src/components/ErrorBoundary.tsx` — Error boundary wrapper

### UI Design

- CSS variables in `globals.css` for light/dark themes
- Theming via `style={{ color: "var(--text-primary)" }}` — no Tailwind color classes for text
- Warm accent color (#d4a574 dark / #b8845a light)
- Collapsible sidebar: 280px full / 60px icon-only on desktop, hidden on mobile (BottomNav instead)
- PWA with iOS viewport fix

### Database Schema

Managed by Drizzle. Single source of truth: `src/lib/db/schema.ts`. Migrations in `drizzle/`.

Tables (17 total):
- `profiles` — single-user profile
- `spaces` — areas of life that group tasks/goals/habits
- `tags` — user-defined tags
- `tasks` — Franklin Covey A/B/C priorities, recurrence, rollover, space/goal linking
- `habits` + `habit_logs` — habit tracking with target days, streaks
- `journal_entries` — daily journal with mood + full-text search
- `workout_templates` + `workout_exercises` + `workout_logs` + `workout_log_exercises`
- `focus_sessions` — Pomodoro timer sessions linked to tasks
- `goals` + `goal_progress_logs`
- `weekly_reviews` — weekly review summaries (source: dashboard | mcp)
- `daily_briefings` — daily briefings saved by OpenClaw (source: dashboard | mcp)
- `insight_cache` — cached insights saved by OpenClaw (source: dashboard | mcp)

## Environment Variables

Required (in `.env` for Docker compose, `.env.local` for local `npm run dev`):

- `DATABASE_URL` — Postgres connection string
- `SELF_HOSTED_USER_ID` — UUID for the one user; must exist as a row in `profiles`
- `MCP_API_KEY` — Bearer token OpenClaw sends on every `/api/mcp` request

Optional:
- `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_DESCRIPTION`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — only used by the Postgres compose service

## Deployment

See `docs/DEPLOY.md` for the full VPS walkthrough: Docker + compose + Tailscale + OpenClaw connection config. One-time bootstrap, then `git pull && docker compose up -d --build app` for updates.

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript 5
- Tailwind CSS 4
- Drizzle ORM + `postgres` (postgres.js) on self-hosted Postgres 16
- `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- Lucide React (icons)
- Vitest + React Testing Library
- PWA (manifest + service worker)
- Docker + docker-compose for deploy
