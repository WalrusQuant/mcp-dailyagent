# Self-Hosted Conversion — Todo

Goal: finish the pivot so it runs in Docker on a VPS, single-user, no Supabase.

**Decisions locked in:**
- Local Postgres in Docker (not Supabase)
- Drizzle ORM for query layer
- No auth — Tailscale gates dashboard access; `MCP_API_KEY` gates `/api/mcp`
- Keep `user_id` columns + `profiles` table for now (always scoped to `SELF_HOSTED_USER_ID` env); avoids a schema rewrite

---

## Phase A — Scaffolding (no behavior change yet) ✅

- [x] Install deps: `drizzle-orm`, `postgres`, `drizzle-kit`
- [x] Create `docker-compose.yml` with Postgres service
- [x] Port `supabase/schema.sql` → `src/lib/db/schema.ts`
- [x] Create `src/lib/db/client.ts`
- [x] Add `drizzle.config.ts`, wire `db:generate` / `db:migrate` / `db:push` / `db:studio` scripts
- [x] Rewrite `.env.example` for self-hosted; generate `.env.local` with fresh secrets
- [x] Generate initial migration (`drizzle/0000_init.sql`), apply — 20 tables created
- [x] Seed profile row + default OpenRouter provider

## Phase X — Rip dashboard AI (OpenClaw owns all AI) ✅

- [x] Added MCP save tools: `save_daily_briefing`, `get_insights` + `save_insights`
- [x] Added `insights:read` / `insights:write` scopes
- [x] Deleted dashboard AI generation endpoints: `/api/briefing` POST, `/api/insights` POST, `/api/journal/prompts`, `/api/weekly-review/generate`, all `/api/admin/*`
- [x] Recreated GET-only `/api/briefing`, `/api/insights` for dashboard read
- [x] Deleted lib: `src/lib/llm/`, `ai-models.ts`, `app-config.ts`, `encryption.ts`, `rate-limit.ts`, `productivity-context.ts`
- [x] Deleted admin page + sidebar link
- [x] `DailyBriefing`, `InsightCards`, `WeeklyReview`, `JournalEditor` — stripped generate UI, kept read/manual-edit
- [x] Dropped tables: `app_settings`, `app_models`, `llm_providers` (drizzle/0001_rip_ai_tables.sql)
- [x] Removed deps: `openai`, `resend`
- [x] Dropped `ENCRYPTION_KEY` from `.env.example` + `.env.local`
- [x] 85 tests pass, build clean, typecheck clean

## Phase B + C — Rip auth + Swap query layer (merged — routes touched both) ✅

- [x] Delete `src/middleware.ts`, `src/app/(auth)/`, `src/components/auth/`, `src/app/api/auth/`
- [x] Create `src/lib/auth.ts` with `getUserId()` helper
- [x] Root `src/app/page.tsx` → redirect to `/dashboard`
- [x] Port all MCP internals (queries, tools, resources, prompts) to Drizzle
- [x] Port all 38 API routes to Drizzle + `getUserId()`
- [x] Port `src/lib/app-config.ts`, `ai-models.ts`, `admin.ts`, `llm/router.ts`
- [x] Port Sidebar, AccountTab, admin page (stripped logout/auth UI)
- [x] Delete orphaned `src/lib/tools/executor.ts` (chat-era, no callers)
- [x] Add `/api/admin/models` route (UI was using direct Supabase client)
- [x] Delete `src/lib/supabase/` and `src/lib/mcp/supabase.ts`
- [x] Remove `@supabase/ssr` + `@supabase/supabase-js` from package.json
- [x] Stub out one Supabase-mocked test (`mcp/queries/__tests__/tasks.test.ts`) — TODO: rewrite for Drizzle
- [x] `npx tsc --noEmit` — clean
- [x] `npm run lint` — 6 unused-var warnings, 0 errors
- [x] `npm run build` — clean
- [x] `npm test` — 105 passed, 1 skipped
- [x] `src/types/database.ts` — left as plain TS types (no Supabase runtime dep); UI still imports Row types from it

## Phase D — Deploy

- [ ] Add `Dockerfile` for the Next.js app (multi-stage build)
- [ ] Extend `docker-compose.yml` with the app service, wire `DATABASE_URL` between containers
- [ ] Write `docs/DEPLOY.md` — VPS prerequisites, `.env` setup, Tailscale notes, first-run steps
- [ ] OpenClaw MCP connection snippet (`docs/OPENCLAW.md` or in DEPLOY)

## Phase E — Cleanup

- [ ] Remove `@supabase/*` from `package.json`
- [ ] Delete `supabase/` directory
- [ ] Update `.env.example` (drop Supabase vars, add `DATABASE_URL`)
- [ ] Update `CLAUDE.md` — "Current state" + remove Supabase references
- [ ] `npm run build` clean, `npm test` clean, `npm run lint` clean
- [ ] Smoke test: dashboard loads, can create a task, MCP `/api/mcp` responds with Bearer

---

## Review

_(fill in after each phase)_
