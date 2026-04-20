# AI Rip Plan

Branch: `self-hosted-ai-rip` (already created)

**Guiding principle:** MCP server = hardened data layer for OpenClaw. Dashboard = viewer/editor. No AI in dashboard. OpenClaw brings its own model.

**Nothing below gets deleted until you sign off on the full list.**

---

## Definitely delete

### API routes (dashboard-side AI generation)
- `src/app/api/briefing/route.ts` — dashboard-generated daily briefing (OpenClaw generates instead)
- `src/app/api/insights/route.ts` — dashboard-generated insights (OpenClaw generates instead)
- `src/app/api/journal/prompts/route.ts` — dashboard-generated journal prompts (OpenClaw generates instead)
- `src/app/api/weekly-review/generate/route.ts` — dashboard-generated weekly review (OpenClaw generates instead)
- `src/app/api/admin/providers/route.ts` — OpenRouter provider config (unused now)
- `src/app/api/admin/settings/route.ts` — OpenRouter key storage (unused now)
- `src/app/api/admin/settings/test/route.ts` — test OpenRouter key (unused now)
- `src/app/api/admin/models/route.ts` — model list CRUD (unused now)

### Lib files (OpenRouter / AI plumbing)
- `src/lib/llm/` (entire directory) — OpenRouter client + router + adapters
- `src/lib/ai-models.ts` — per-task model routing
- `src/lib/app-config.ts` — DB-first config with env fallback; only purpose was OpenRouter key
- `src/lib/encryption.ts` — AES-256-GCM; only used for encrypting OpenRouter key
- `src/lib/rate-limit.ts` — in-memory rate limiter; only used for dashboard AI endpoints
- `src/lib/productivity-context.ts` — only feeds dashboard AI calls (confirm no other callers before delete)

### UI pages / components
- `src/app/(protected)/admin/page.tsx` — admin panel for OpenRouter + models
- Admin link in `src/components/layout/Sidebar.tsx`
- `src/components/dashboard/DailyBriefing.tsx` — the generate-a-briefing widget. Replace with a **read-only** "latest briefing" display pulling from the `daily_briefings` table.
- `src/components/dashboard/InsightCards.tsx` — the generate-insights widget. Replace with read-only display pulling from `insight_cache`.
- Weekly review "Generate" button UI in `src/components/review/` — keep the review view; remove the generate button.
- Journal AI-prompt UI in `src/components/journal/` — keep editor; remove AI prompt fetch UI.

### DB tables
- `app_settings` — only held OpenRouter key
- `app_models` — only held model config for dashboard-side AI
- `llm_providers` — only held OpenRouter row

**Drizzle schema:** remove `appSettings`, `appModels`, `llmProviders` from `src/lib/db/schema.ts`. Generate a drop migration.

### Dependencies
- `openai` — was the OpenRouter SDK client
- `resend` — email SDK, only used by the old auth invite flow (confirm before deleting — double-check no callers)

### Env vars
- `ENCRYPTION_KEY` — only used to encrypt OpenRouter key
- Update `.env.example` + `.env.local` to drop it

### Docs / index
- Admin section in CLAUDE.md — remove or rewrite

---

## Keep (explicitly)

- **All productivity tables:** `profiles`, `tasks`, `habits` + `habit_logs`, `journal_entries`, `workouts/*`, `focus_sessions`, `goals` + `goal_progress_logs`, `spaces`, `tags`
- **Content tables OpenClaw writes to, dashboard reads:** `daily_briefings`, `weekly_reviews`, `insight_cache`
- **All MCP tools** (`src/lib/mcp/tools/*`) — OpenClaw calls these to read and write
- **All MCP resources** (`src/lib/mcp/resources/*`) — OpenClaw reads via these
- **All MCP prompts** (`src/lib/mcp/prompts/index.ts`) — these are the versioned templates OpenClaw's skill will call instead of maintaining its own. This is the whole point.
- **All MCP queries** (`src/lib/mcp/queries/*`) — internal helpers for tools/resources
- **All dashboard CRUD routes** (tasks, habits, journal, workouts, focus, goals, projects, tags, calendar, dashboard, profile, weekly-review read-only)
- **All dashboard UI for productivity data** (tasks list, habit tracker, journal editor, workouts, focus timer, goals, calendar, etc.)
- **MCP auth layer** (`MCP_API_KEY` bearer token) — this is how OpenClaw authenticates
- **Single-user profile + `SELF_HOSTED_USER_ID`** — scoping stays

---

## Flag resolutions (as of review)

1. **`productivity-context.ts`** — zero callers in src/. Safe to delete.
2. **`resend` dep** — zero callers in src/. Safe to delete.
3. **Dashboard widgets** — read-only display, confirmed.
4. **MCP tools audit** — zero LLM calls in any MCP tool. Clean. BUT: found a gap (see below).

## Gap to fix before rip (CRITICAL)

The dashboard currently generates briefings and insights via `/api/briefing` and `/api/insights`. Ripping those means OpenClaw needs MCP save tools to write that content back. Current state:

- `tools/briefings.ts` has `get_daily_briefing` but **no `save_daily_briefing`** — gap.
- **No insights tool file exists at all** — gap. `insight_cache` table has no MCP interface.
- `tools/reviews.ts` has both `get_weekly_review` and `save_weekly_review` — OK.

**Must add before deleting dashboard endpoints:**
- `save_daily_briefing` tool in `src/lib/mcp/tools/briefings.ts`
- New `src/lib/mcp/tools/insights.ts` with `get_insights` + `save_insights`
- Register insights tools in `src/lib/mcp/server.ts`
- Add `briefing:write` and `insights:read` / `insights:write` scopes to `src/lib/oauth-scopes.ts` if scope expansion needs them

---

## Execution order (if approved)

1. Grep for callers of `productivity_context.ts`, `resend`, etc. — resolve the flags above.
2. Delete API routes + lib files first. Run build + tests.
3. Delete UI components. Swap widgets to read-only. Run build + manually click through.
4. Drop schema tables. Generate + apply drop migration.
5. Remove deps from `package.json`. `npm install`. Build.
6. Update `.env.example`, `.env.local`, `CLAUDE.md`.
7. Merge to main when you say the word.

Each step is its own commit so we can bisect if anything breaks.

---

## Your review

Things to decide / confirm before I touch anything:
- [ ] The "Definitely delete" list is correct and complete
- [ ] Dashboard widgets: read-only display (my assumption) vs. remove entirely
- [ ] Anything in "Keep" you actually want gone
- [ ] OK to drop `resend` if no callers
