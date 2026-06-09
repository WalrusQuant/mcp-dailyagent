# Code Review Findings — 2026-06-09

Full-project review covering the MCP server, DB layer, API routes, frontend, and
infrastructure. Status checkboxes track progress.

**Status: all 47 findings resolved (2026-06-09).**

Baseline at time of review (commit `5bae56e`): 332/332 tests pass, `tsc --noEmit`
clean, ESLint clean. Tests pass only under `TZ=UTC` — see C1.

---

## Critical

### C1. `src/lib/dates.ts` breaks for any user east of UTC — browser-freezing infinite loop
- [x] Fixed — all arithmetic now component-based via `Date.UTC` (no `toISOString()`
  round-trips); `getNextOccurrence` rewritten on the same helpers; Vitest now runs
  under `TZ=Pacific/Auckland` by default so this bug class fails in CI.

`addDays`, `startOfWeek`, `endOfWeek`, `getDateRange` (`src/lib/dates.ts:13-40`) parse
`date + "T00:00:00"` as **local** time but emit via `toISOString()` (**UTC**). In any
UTC+ timezone the round-trip loses a day. Reproduced under `TZ=Europe/Berlin`:
`addDays("2026-06-09", 1)` → `"2026-06-09"` (no-op); `addDays(..., -1)` skips two days.

Consequences:
- `getDateRange`'s `while (current <= end)` never advances → **infinite loop, frozen
  tab**, triggered client-side from `HabitTracker.tsx:34` on Habits page load for
  users in UTC+1..+14.
- DateNavigation "next" button is a no-op; `startOfWeek` returns the wrong day,
  shifting all week math (`get_week_summary`, weekly prompts, WeeklyReview UI).
- Server-side `getNextOccurrence` (`src/lib/mcp/queries/tasks.ts:67-86`) has the same
  flaw: completing a daily recurring task spawns a duplicate **on the same day**.

Fix: do all date arithmetic in pure string/local-date space; never round-trip through
`toISOString()`. Add a CI test run under a non-UTC `TZ` so it stays fixed.

### C2. `getToday()` uses the UTC day, not the user's day
- [x] Fixed — `getToday()` now returns the runtime's local calendar date (browser =
  user's day; server = container `TZ`, exposed via compose + `.env.example`, default
  UTC). All ~30 inline UTC-today sites replaced with `getToday()`/`addDays()`;
  day-window queries on `started_at` use local instants; focus-session bucketing
  uses the new `toLocalDate()`. Honoring `profiles.timezone` per-request remains a
  possible future enhancement.

`src/lib/dates.ts:1-3` (`new Date().toISOString().split("T")[0]`) keys everything —
tasks default date, habit checkmarks, journal entry date, focus queries, briefing
lookup, rollover, dashboard — to the UTC calendar date. New York at 9pm sees
tomorrow's empty list; Tokyo before 9am sees yesterday's. `DateNavigation.tsx:49`
duplicates the same expression. `profiles.timezone` exists but is never read by
anything. Internally consistent (client + server both UTC) but wrong wall-clock day
flip for every non-UTC user. Decide: honor `profiles.timezone` or document UTC-only.

### C3. `/api/wipe-data` is CSRF-able — any webpage can destroy all data
- [x] Fixed — route now rejects browser cross-site requests (`Sec-Fetch-Site`),
  requires `Content-Type: application/json` (not no-cors-able; cross-origin needs a
  failing preflight), and requires `{"confirm":"WIPE"}` in the body. Dashboard
  Danger Zone sends the confirm body.

`src/app/api/wipe-data/route.ts:28` is a bare `POST` with no confirmation body and no
Origin/`Sec-Fetch-Site` check; the app has no auth or cookies, so any website open in
a browser on a tailnet device can fire
`fetch("http://<host>/api/wipe-data", {method:"POST", mode:"no-cors"})` and wipe the
DB. Fix: require a JSON body (e.g. `{confirm:"WIPE"}`, forcing a CORS preflight)
and/or check `Sec-Fetch-Site`/`Origin`. The wipe logic itself is correct (all 16
tables, FK-safe order, transactional).

---

## High — task lifecycle

### H1. Recurring-task completion is not idempotent (duplicate next occurrences)
- [x] Fixed — shared `maybeSpawnNextOccurrence` helper (queries/tasks.ts) used by
  MCP `complete_task`/`update_task` and the dashboard PATCH. Spawns only on the
  not-done → done transition, skips unknown recurrence types (next date must be
  strictly after the task date), and dedupes against an existing occurrence on the
  target date (covers retries and un-done/re-done toggles). Covered by tests.

Both paths — MCP `complete_task` (`src/lib/mcp/tools/tasks.ts:290-304`) and dashboard
PATCH (`src/app/api/tasks/[id]/route.ts:98-112`) — run the "spawn next occurrence"
branch whenever `done: true` arrives, without checking the previous done state.
Retries or toggling done off/on insert duplicates. Neither checks for an existing
task on the target date; neither wraps update+insert in a transaction. Also: an
unrecognized `recurrence.type` falls through `getNextOccurrence`'s switch and returns
the input date → same-day duplicate.

### H2. Rollover works only once per task and falsifies completion history
- [x] Fixed — rollover now moves undone past tasks to today **in place** (single
  UPDATE): no copies, nothing marked done, so history stays truthful, goal links
  survive, and a still-undone task rolls again tomorrow. `rolled_from` is set to
  the task's own id on first roll so the "rolled over" badge still renders. The
  check endpoint drops the `isNull(rolledFrom)` filter accordingly.

`src/app/api/tasks/rollover/route.ts:24,47-50` (+ `rollover/check/route.ts:21`):
- Candidates filtered with `isNull(tasks.rolledFrom)`, but rolled copies have
  `rolledFrom` set → a still-undone rolled task can never roll again; check endpoint
  reports `count: 0` while the task lingers as overdue.
- Undone originals are marked `done: true, doneAt: now()` → never-completed tasks
  count as completed in calendar views, exports, and **inflate goal auto-progress**.

### H3. Recurrence and rollover copies silently drop `goal_id`
- [x] Fixed — `maybeSpawnNextOccurrence` copies `goalId` (and notes/space/priority/
  sort order) on every path including the dashboard PATCH, which previously dropped
  it; in-place rollover preserves all fields by construction. Test asserts the goal
  link survives recurrence.

`tasks/[id]/route.ts:102-111` and `rollover/route.ts:33-43` copy
title/notes/priority/spaceId/recurrence/sortOrder but omit `goalId`, permanently
breaking goal linkage (and goal auto-progress) for recurring/rolled tasks.

### H4. `update_task(done: true)` diverges from `complete_task`
- [x] Fixed — `update_task` now spawns the next occurrence on done-transition via
  the same helper (both versioned and last-write-wins paths) and its description
  documents the behavior.

MCP `update_task` does not spawn the next recurrence while `complete_task` does
(`src/lib/mcp/tools/tasks.ts`). An agent using `update_task` to finish a recurring
task silently breaks the chain. Unify or document.

---

## Medium

### Data loss / integrity

### M1. Journal update silently wipes `mood`
- [x] Fixed — omitted `mood` is excluded from the upsert SET / optimistic patch in
  the MCP tool and `queries/journal.ts` (explicit null still clears where the input
  type allows it); tool description documents the behavior. Regression tests cover
  both paths.

`src/lib/mcp/tools/journal.ts:104,111,228` (and `queries/journal.ts`
`createOrUpdateJournalEntry`): omitted `mood` is coerced to `null` in both the upsert
and optimistic paths, so re-saving content destroys recorded mood. Omit the field
from SET when undefined.

### M2. Journal editor loses in-flight keystrokes on first autosave; duplicate-entry window
- [x] Fixed — editor keyed on `date` only (no remount when the first save assigns an
  id); entry id tracked in a ref that flips POST→PATCH in place; saves serialized
  through an in-flight guard with latest-value refs (queued changes re-save after
  the current request, so no duplicate POST and nothing typed mid-request is lost);
  per-autosave toast removed (editor's own "Saving..." indicator remains).

`src/components/journal/JournalView.tsx` keys the editor on
`${date}-${todayEntry?.id || "new"}`; the first autosave POST sets `todayEntry`, the
key changes, and the editor remounts with the saved snapshot — text typed during the
round trip is deleted and focus lost. Until the response lands, `entryId` is
undefined, so a second debounce can POST again → unique `(user_id, entry_date)`
violation → raw 500 (see M8). Also toasts "Journal saved" on every autosave.

### M3. Untransacted delete-then-insert in workout exercise replacement
- [x] Fixed — all six paths transactional: REST log/template POST (parent+children),
  REST log/template PATCH (delete+reinsert rolls back together), MCP `logWorkout`,
  `createWorkoutTemplate`, `updateWorkoutLog`. Both PATCH routes now 404 before
  touching child rows when the parent doesn't exist or isn't the user's.

`src/app/api/workouts/logs/[id]/route.ts:92-119`,
`workouts/templates/[id]/route.ts:69-98`, and MCP `updateWorkoutLog`
(`src/lib/mcp/tools/workouts.ts:259-288`): DELETE all exercises then INSERT new, no
transaction — a failed insert (e.g. missing `exercise_name` → not-null violation;
items are never validated) permanently destroys the old list. POST counterparts
(`logs/route.ts:69-98`, `templates/route.ts:58-88`, MCP `logWorkout`/
`createWorkoutTemplate` at `tools/workouts.ts:172-238`) insert parent+children
untransacted → orphan parents on failure. The DELETE also never verifies the parent
belongs to the user / exists (preceding UPDATE row count unchecked). Use
`db.transaction` like `logGoalProgress` (`queries/goals.ts`).

### M4. `GET /api/goals` mutates the database; upsert race → 500
- [x] Fixed — progress-log writes are atomic `ON CONFLICT (goal_id, log_date) DO
  UPDATE` (no select-then-insert race), all writes batched in one transaction, goals
  with no linked items are skipped (no stale snapshots), and writes only happen when
  a value actually changed — steady-state GETs are now read-only. (Recompute-on-GET
  itself retained by design.) Note: auto-progress accuracy also benefits from H2's
  rollover fix, which stopped inflating done counts.

`src/app/api/goals/route.ts:27-115`: list endpoint recomputes auto progress, UPDATEs
`goals`, and upserts `goal_progress_logs` via select-then-insert (non-atomic against
the unique `(goal_id, log_date)` index — concurrent dashboard loads → unique
violation → 500), sequentially awaited per goal (N+1 on a GET). Also writes a stale
progress log for auto goals with no linked items. Auto-progress counts every linked
task ever, so rolled-over "completed" originals (H2) inflate it.

### Type drift (`src/types/database.ts` — drift test only checks field names, not value types)

### M5. `FocusSession.status` omits `"paused"`
- [x] Fixed — `"paused"` added to the wire union; invariant test asserts all four
  statuses stay assignable.

`src/types/database.ts:157` declares `"active" | "completed" | "cancelled"`, but
`schema.ts:336`, migration `0005`, and MCP `pause_focus_session`
(`tools/focus.ts:273,281`) all use `"paused"`.

### M6. `habits.target_days` nullable in DB, non-null `number[]` in types
- [x] Fixed — column is now `NOT NULL` (migration `0006_nostalgic_wong.sql`
  backfills any NULL rows to `{1..7}` before tightening). Verified on real
  Postgres 16: fresh apply and upgrade-from-0005 with an existing NULL row both
  succeed. Drift test asserts the schema column stays `notNull`.

`schema.ts:179` has a default but no `.notNull()` (confirmed in `0005_snapshot.json`).
An explicit `target_days: null` write succeeds, then components iterating it crash.
Make the column `NOT NULL` (with migration) or fix the type + guards.

### M7. `default_weight` serialized as string, typed as number
- [x] Fixed — `serializeExercise` converts the postgres.js numeric string to
  `number | null` (matching the other template path and the wire type), so
  WorkoutLogger no longer copies strings into the `sets` jsonb. Invariant test
  covers both the numeric and null cases.

`numeric` columns come back as strings from postgres.js. `serializeExercise`
(`src/lib/mcp/queries/workouts.ts:41`) passes the raw string through (the path used by
dashboard `/api/workouts/templates`), while line 223 converts with `Number()`.
`WorkoutLogger.tsx:32` then copies the string into the `sets` jsonb, polluting logged
data with mixed types.

### MCP correctness

### M8. Duplicate-day journal POST returns raw 500
- [x] Fixed — new `isUniqueViolation` helper (checks PG code 23505) maps duplicate
  dates to 409 with a clear message in journal POST and journal/[id] PATCH; tags
  route upgraded from message-sniffing to the same helper.

`src/app/api/journal/route.ts:86-96` doesn't upsert or map the unique
`(user_id, entry_date)` violation to 409 (the way `tags` does); same for
`journal/[id]` PATCH of `entry_date`. Leaks constraint name in the error.

### M9. `getWeekSummary` computes expected habits from the current month's grid
- [x] Fixed — expected counts derive from `getDateRange(weekStart, weekEnd)` with
  TZ-safe `getDayOfWeek`; regression test covers a week months outside the current
  grid (daily + weekday habits).

`src/lib/mcp/queries/calendar.ts:160,255`:
`getCalendarGridDates(today.slice(0, 7))` builds the grid around **today**, then
filters to the requested week — any week outside the current month's grid gets 0
expected habits. Derive from `getDateRange(weekStart, weekEnd)` instead.

### M10. `weekly_review` prompt journal stats wrong for past weeks
- [x] Fixed — new `fetchJournalForRange` queries the requested week directly;
  "Entries written" is now correct for any `week_start`.

`src/lib/mcp/prompts/index.ts:704-716`: fetches the 7 most recent entries overall,
then filters to the week — for a past week (the documented use), "Entries written"
reports 0. Query the date range directly.

### M11. `habit_analysis` prompt mislabels partial-week habits
- [x] Fixed — `fetchAllHabitsWithStats` rates against `getApplicableDays` over the
  habit's `target_days` (window corrected to 30 days inclusive, capped at 100%), so
  a perfect 3×/week habit reads 100%, not ~43%. Benefits both habit_analysis and
  the weekly-planning prompt that share the helper.

`src/lib/mcp/prompts/index.ts:115-141`: `completionRate = completions / 30` ignores
`target_days`/frequency (a perfect 3×/week habit caps at ~43% → labeled
"struggling"); window is 31 days inclusive so daily habits can exceed 100%. Use
`getApplicableDays` like `getHabitStats` (`queries/habits.ts`).

### M12. MCP resources swallow query errors
- [x] Fixed — all 14 resource read handlers now `throw new Error(result.error)`
  when the query fails, which the MCP SDK surfaces as a JSON-RPC error instead of
  fake-empty data.

All of `src/lib/mcp/resources/*.ts` return `result.data ?? []/null` and never inspect
`result.error` — DB failure is indistinguishable from "no data". Surface errors like
the tools do.

### Frontend

### M13. Pomodoro timer drifts and stalls in background tabs
- [x] Fixed — tick effect recomputes remaining from the persisted wall-clock
  `startTime` on every tick (interval is created once per run, not per second)
  and resyncs on `visibilitychange`, so throttled/suspended tabs snap back to
  the correct time and completion fires even after long suspensions.

`src/hooks/useFocusTimer.ts:109-127`: decrement-per-tick countdown with no wall-clock
resync; effect deps `[isRunning, secondsLeft]` recreate the interval every second
(cumulative drift); background-tab throttling reduces ticks to ~1/min or suspends
them. `startTime` is persisted but only consulted in the mount effect (line 82), and
`FocusTimerProvider` never remounts during SPA navigation. Fix: recompute remaining
from `startTime` on every tick + on `visibilitychange`.

### M14. Habit completion rate shows e.g. "4700%" after toggling
- [x] Fixed — the post-toggle local recompute now produces a 0–1 fraction and
  reuses the stats endpoint's `calculateStreak`/`getApplicableDays` (target-day
  aware, capped at 100%), so the optimistic value matches what a reload shows.

Server sends `completionRate` as a 0–1 fraction; `HabitTracker.tsx:126`'s local
recompute after toggle produces an already-×100 value, and `HabitRow.tsx:81` /
`HabitStats.tsx:36` multiply by 100 again. Local denominator (flat 30) also disagrees
with the server's target-day-aware `applicableDays`.

### M15. Insight dismissals keyed by array index, persisted forever
- [x] Fixed — dismissal keys are now `cache_date + title + body` (so a dismissal
  can never hide a different future insight), the stored set is pruned to the
  currently served insights on load (no unbounded localStorage growth), and the
  render iterates the filtered `visible` list so at most 3 cards show.

`src/components/dashboard/InsightCards.tsx`: `insight-${i}` in localStorage with no
date/content scoping — dismissing insights 0–2 hides every future insight at those
indices permanently. Secondary: `visible.slice(0, 3)` computed but render iterates
`insights`, so >3 cards can render.

### M16. No fetch cancellation / staleness guards on rapid navigation
- [x] Fixed — TaskList, JournalView (load + search), GoalList, CalendarView
  (month), and WeeklyReview all abort the in-flight fetch via AbortController on
  param change/unmount; CalendarView's click-driven day detail uses a request
  counter (latest request wins, close invalidates in-flight).

`TaskList.tsx:111-128`, `JournalView.tsx` (`loadData`), `GoalList.tsx` (status tabs),
`CalendarView.tsx` (`fetchMonth`), `WeeklyReview.tsx`: fetch-then-setState with no
AbortController/ignore flag — a stale slow response can render the wrong day's data.
`Sidebar.tsx` has the correct `cancelled`-flag pattern to copy.

### Infra

### M17. Service worker never installs (leftover from old chat app)
- [x] Fixed — precache list is now `/dashboard` + manifest + icons under
  `cadence-v1` (`/` is intentionally excluded: it redirects, which both fails
  `addAll` and can't be served for navigations); registration failures are
  logged instead of swallowed. Comment in `sw.js` documents that cached
  navigations only refresh via manual `CACHE_NAME` bumps.

`public/sw.js:1-9`: `CACHE_NAME = "chat-v6"`, `STATIC_ASSETS = ["/", "/chat"]` — no
`/chat` route exists, `cache.addAll` rejects, the `install` event fails every time,
so PWA offline support is entirely dead. Registration errors swallowed
(`src/app/layout.tsx:58`). After fixing the precache list, note navigation cache only
busts via manual `CACHE_NAME` bumps.

### M18. Docker images publish with no CI gate
- [x] Fixed — `ci.yml` is now `workflow_call`-able and `docker.yml` runs it as a
  gate (covers tag pushes too, which CI's own triggers never did). Added a
  `smoke-test` job that builds the amd64 image, boots it against a real Postgres 16
  service, and requires `/api/mcp/health` to respond — publish needs both jobs
  green. Also removed the stale Supabase/OpenRouter/SIGNUP_SECRET env vars from
  ci.yml's build job (part of L19).

`.github/workflows/docker.yml:3-10` builds + pushes `:latest`/semver on every push to
`main` and on `v*.*.*` tags, with no coupling to `ci.yml` (which doesn't trigger on
tags at all). A red commit ships to everyone running `docker compose pull`. Gate the
publish on lint/test/build.

### M19. Boot-time `drizzle-kit migrate` works only by npm-hoisting accident
- [x] Fixed — boot now runs `scripts/migrate.mjs`, a plain-JS runner on
  drizzle-orm's programmatic `migrate()` (postgres-js migrator): no drizzle-kit,
  esbuild, or TS config in the image. Dockerfile drops the drizzle-kit/config/
  schema COPYs. Verified against real Postgres 16: fresh apply (17 tables, 6/6
  migrations), idempotent re-run, non-zero exit on failure (so `set -e` aborts
  boot), seamless takeover of a drizzle-kit-migrated DB (same
  `drizzle.__drizzle_migrations` table), and the runner works with only
  drizzle-orm + postgres in node_modules (the exact image COPY set). The new CI
  smoke test (M18) guards this class of breakage permanently. `npm run db:*`
  dev commands still use drizzle-kit locally.

`Dockerfile:40` copies `node_modules/drizzle-kit`, `drizzle-orm`, `postgres` — but
`drizzle-kit/bin.cjs` hard-requires `esbuild` (to load the TS config). It currently
rides along only because drizzle-kit pins `esbuild ^0.25.x` while the top-level tree
has `0.27.x`, so npm nests it under `drizzle-kit/node_modules`. When versions
converge, every container boot crash-loops (`set -e`), and no workflow ever boots the
built image to catch it. Fix: use drizzle-orm's programmatic `migrate()` (no
TS-config load), or convert config to `.js`, or copy esbuild explicitly.

### M20. `backups/` (pg_dump output) not in `.gitignore` / `.dockerignore`
- [x] Fixed — `/backups/` added to `.gitignore`, `backups` to `.dockerignore`.

`docker-compose.yml:64` bind-mounts `./backups` inside the git working tree on the
from-source path; `git add -A` can commit full DB dumps and `COPY . .`
(`Dockerfile:13`) pulls them into build context. One-line fix in both files.

### M21. `NEXT_PUBLIC_*` runtime env vars are no-ops with the prebuilt image
- [x] Fixed — vars dropped entirely; branding hardcoded to "Cadence" in
  `layout.tsx`. Investigation showed they were no-ops on **both** Docker paths
  (no build args, `.env` dockerignored), and all pages are statically
  prerendered so a server-var rename alone wouldn't have worked either.
  Removed from `.env.example`, both compose files, README, CLAUDE.md. Side
  effect: also resolves L20's `source .env` bullet (the unquoted multi-word
  value was `NEXT_PUBLIC_SITE_DESCRIPTION`).

`docker-compose.example.yml:48-49` + `.env.example:25-26`: Next.js inlines
`NEXT_PUBLIC_*` at build time; the GHCR image bakes them as undefined so setting them
in `.env` does nothing. They're only read in a server component
(`src/app/layout.tsx:16-17`) — rename to non-`NEXT_PUBLIC_` server vars or drop.

---

## Low

### L1. Malformed JSON returns 500, not 400
- [x] Fixed — new `readJsonBody` helper (`src/lib/api-body.ts`) returns null on
  missing/malformed/non-object bodies; all 22 POST/PATCH routes now respond 400.
  wipe-data kept its own hardened parse (C3 semantics preserved).

Every POST/PATCH except `profile` calls `await request.json()` outside try/catch
(~20 sites, e.g. `tasks/route.ts:54`, `habits/[id]/route.ts:40`,
`journal/route.ts:67`, `tasks/reorder/route.ts:10`).

### L2. Unvalidated values surface as raw PG 500s
- [x] Fixed — 400s with clear messages for: task priority (`^[A-C][1-9]$`),
  task/goal/journal/workout date strings (YYYY-MM-DD), recurrence shape
  (type ∈ daily|weekdays|weekly|monthly), goal category/status/progress
  (integer 0-100)/progress_mode, journal mood (integer 1-5, floats rejected),
  focus timestamp validity. MCP: `list_tasks.date` uses `dateSchema`; goal
  `progress` schemas gained `.int()`. Covered by new zod-layer tests.

Task `priority` (must match `^[A-C][1-9]$`, `schema.ts:162`) unvalidated at
`tasks/route.ts:70` / `tasks/[id]/route.ts:46`; goal `category`/`status`/`progress`
(`goals/route.ts:139-144`, `goals/[id]/route.ts:66-68`); journal `mood` accepts
floats into an integer column (`journal/route.ts:74-81`); `new Date()` from
unvalidated strings (`tasks/[id]/route.ts:49`, `focus/[id]/route.ts:32,37`);
`body.recurrence` stored with no shape check (`tasks/[id]/route.ts:53`). MCP-side:
`list_tasks.date` is bare `z.string()` without `dateSchema` (`tools/tasks.ts:160`,
breaks the overdue-rollover string comparison for variant formats); goal `progress`
missing `.int()` (`tools/goals.ts:180,217`).

### L3. `calculateStreak` never resets after a lapse; dashboard streak hardcoded 0
- [x] Fixed — streak walk now breaks on any unlogged applicable day (today
  unlogged gets a one-time grace), uses TZ-safe date helpers throughout.
  Dashboard route computes the real max streak across habits with one batched
  log query (no N+1) via the same shared `calculateStreak`. 23 new unit tests.

`src/lib/habit-stats.ts:1-27`: walks back past all unlogged days, so a 5-day run from
months ago still reports 5; also mixes UTC date strings with local `getDay()`.
Meanwhile `dashboard/route.ts:114` always sends `streak: 0`, so the streak badge in
`HabitWidget.tsx:38` / `DailyStartCard.tsx:121-128` never renders.

### L4. MCP rate limiting applies only after successful auth
- [x] Fixed — failed auth attempts consume from a separate per-IP token bucket
  (`auth_fail:<ip>`, 10 burst / 1 per min, first `x-forwarded-for` hop) and
  return 429 + Retry-After when exhausted; per-user post-auth limiter
  unchanged.

`src/app/api/mcp/route.ts:32-57`: limiter keyed by `auth.userId` after auth, so
bearer-token brute-force attempts are unthrottled (mitigated by `timingSafeEqual` +
Tailscale, but contradicts the in-code comment).

### L5. "Focus session complete!" toast fires on cancel/reset
- [x] Fixed — hook exposes `workSessionCompletedCount`, incremented only in
  `completeWork()`; the toast watches that instead of the isActive transition.
  Reset still refreshes the session list, just without the toast.

`src/components/focus/FocusTimer.tsx:52-58` toasts on every `isActive` true→false
transition, including user abandonment (session marked `cancelled`).

### L6. Fetch inside `setState` updater in task reorder
- [x] Fixed — reorder computed outside the updater (no double-fire under
  StrictMode); failed PATCH reverts to the pre-drop order and toasts.

`src/components/tasks/TaskList.tsx:42-70`: `handleDrop` PATCHes
`/api/tasks/reorder` from inside the `setTasks` updater (React may invoke updaters
twice; StrictMode does) and `.catch(() => {})` silently desyncs order on failure.

### L7. Optimistic updates without rollback / swallowed failures on inline actions
- [x] Fixed — SpaceDashboard (toggle/progress), TaskList (toggle/delete),
  HabitTracker (toggle/delete), WorkoutLogger (save), DailyStartCard
  (complete) all check `response.ok`, revert optimistic state on failure, and
  toast. HabitTracker reconciles with the server's `logged` flag on success.

`SpaceDashboard.tsx` (`handleToggleTask`, `updateProgress`): state-first, no
`response.ok` check, no rollback. `TaskList.handleToggle`/`handleDelete`,
`HabitTracker.handleToggle`/`handleDelete`, `WorkoutLogger.handleSave`,
`DailyStartCard.handleCompleteTask`: non-ok responses (incl. optimistic-concurrency
409s) produce no user feedback. Form modals handle these correctly — mirror that.

### L8. `habits/[id]` PATCH silently drops `null` clears
- [x] Fixed — guards are now presence-based (`"field" in body`): explicit null
  clears nullable columns (description, goal_id) and returns 400 for NOT NULL
  columns (name, frequency, target_days, color, archived, sort_order).

`src/app/api/habits/[id]/route.ts:47-56`: `frequency`/`color`/`sort_order` accept
`null` in the guard then coerce `?? undefined` — returns 200, changes nothing.

### L9. `parseInt` without NaN check → 500
- [x] Fixed — habits/focus/workouts stats routes return 400 when `?days=` is
  present but not a positive integer; defaults preserved when absent.

`habits/stats/route.ts:12-18`, `focus/stats/route.ts:11-15`,
`workouts/stats/route.ts:16`: `?days=abc` → NaN → Invalid Date → throw.

### L10. Profile route emits camelCase, contradicting the API contract
- [x] Fixed — GET/PATCH now speak snake_case per `types/database.ts`;
  AccountTab and Sidebar consumers updated.

`src/app/api/profile/route.ts` returns `displayName`/`avatarUrl`/... while
`types/database.ts:10-23` documents snake_case. Works today (settings components
match) but contradicts the stated contract and every other route.

### L11. Error responses leak internal DB details; status-code inconsistencies
- [x] Fixed — every unexpected-error path now logs via `console.error` and
  returns a generic "Internal server error" (intentional 400/404/409 paths
  untouched); tags/[id] upgraded to `isUniqueViolation`; tasks/spaces/tags
  POST return 201. Calendar local-day bucketing turned out to be already
  fixed by C2's pass — verified, no change needed.

Most catches return `err.message` verbatim (constraint names, SQL);
`profile/route.ts:35,81` returns `String(err)`. `tasks/reorder/route.ts:38-39` shows
the right pattern (log + generic). Also: `tasks`/`spaces` POST return 200 vs 201
elsewhere; `calendar/route.ts:78-79` + `calendar/day/route.ts:49-50` parse day
boundaries server-local but bucket sessions by UTC (`route.ts:149`), inconsistent
with `dashboard/route.ts:78`.

### L12. Workout multi-statement writes (MCP) untransacted
- [x] Fixed — covered by M3 as noted: verified `logWorkout`, `createWorkoutTemplate`,
  and `updateWorkoutLog` all wrap parent+children in `db.transaction`.

Covered by M3's fix — listed separately to ensure MCP `logWorkout` /
`createWorkoutTemplate` / `updateWorkoutLog` get the same `db.transaction` treatment.

### L13. No scope checks on dashboard resource or any prompt
- [x] Fixed — new `checkScopes` helper; dashboard resource requires the six
  read scopes it fetches; all 13 prompts gate on the read scopes of their
  fetched domains via a shared `getPromptAuth` helper.

`src/lib/mcp/resources/dashboard.ts:16`, `prompts/index.ts:26-29`: moot while the
single token gets `all`, but a latent scope bypass if scoped tokens are ever issued.

### L14. Redundant indexes; unindexed self-FK
- [x] Fixed — migration `0007_nostalgic_sumo.sql` drops the four redundant
  indexes and adds `idx_tasks_rolled_from`. Verified on real Postgres 16
  (fresh apply + idempotent re-run).

`schema.ts`: `idx_journal_user_date:231` duplicates the unique index at :232;
`idx_habit_logs_habit_date:208` duplicates :210; `idx_spaces_user:55` is a prefix of
:56; `idx_focus_sessions_user:333` prefix of :334. `tasks.rolled_from` (:150) is the
only FK without a covering index.

### L15. Migration 0004 unique index has no dedupe step
- [x] Fixed — 0004 now deletes same-day duplicates (keeping the most recently
  updated row) before creating the unique index. Editing the shipped file is
  safe: drizzle's migrator skips applied migrations by timestamp, never by
  hash. Verified on real Postgres 16: 0000-0003 + duplicate entries → full
  migrate dedupes (newer row survives) and the index creates cleanly.

`drizzle/0004_silent_prima.sql`: if a pre-0004 deployment has two journal entries on
one day, auto-migration on boot fails → container crash-loop with no documented
remediation. Add a dedupe statement before the index (or document recovery).

### L16. `retry.ts` default predicate retries every error
- [x] Fixed — default predicate now matches its comment: retries fetch
  TypeErrors and 5xx Responses only; AbortError and everything else are not
  retried. No callers relied on the old catch-all.

`src/lib/retry.ts:20`: comment says "network errors and 5xx" but the fallback is
`return true` — programming errors, aborts, 4xx all retried with ~17s backoff.
Default should be `return false` (or at least exclude `AbortError`).

### L17. `isPaused` is `true` when no timer exists
- [x] Fixed — `isPaused = timerState !== null && timerState.pausedAt !== null`.

`src/hooks/useFocusTimer.ts:266`: `timerState?.pausedAt !== null` →
`undefined !== null` → `true`. Currently unconsumed; fix before it bites.

### L18. Dark-theme flash for light-theme users
- [x] Fixed — inline pre-paint script in `<head>` resolves the persisted
  theme (same key, default, and matchMedia semantics as ThemeProvider) and
  sets the html class before first paint.

`src/lib/theme.tsx:49-51` + `src/app/layout.tsx:45`: html class hardcoded `"dark"`
server-side, corrected post-hydration. Add an inline pre-paint script.

### L19. Chat-era debris sweep
- [x] Fixed — `@openrouter/sdk` uninstalled; `infrastructure/hydra/` and
  `docs/index.html` deleted (mkdocs exclude entry removed); ci.yml's stale
  env vars were already removed in M18's pass; CLAUDE.md no longer documents
  the dropped `source` columns.

- `@openrouter/sdk` in `package.json:20` — imported nowhere.
- `infrastructure/hydra/hydra.yml` — dead Ory Hydra OAuth config (old multi-user
  design); references routes that don't exist.
- `.github/workflows/ci.yml:24-28` — stale `NEXT_PUBLIC_SUPABASE_*`,
  `OPENROUTER_API_KEY`, `SIGNUP_SECRET` env vars, referenced nowhere.
- `docs/index.html` — landing page for the previous product; excluded from mkdocs
  build, describes features that don't exist.
- CLAUDE.md still documents `source` columns dropped by migrations 0001/0002.

### L20. Docs/compose corrections
- [x] Fixed — `source .env` breakage resolved by M21 (the multi-word value is
  gone); quick-start and DEPLOY.md no longer recommend the ineffective
  `ufw deny` and correctly describe the bind-based protection (Postgres not
  published at all); DEPLOY.md's `.env` template drops the unused
  `DATABASE_URL` (compose constructs it); both compose files gained an app
  healthcheck hitting `/api/mcp/health`.

- `docs/quick-start.md:87`: `source .env` errors — `.env.example:26` has an unquoted
  multi-word value.
- `docs/quick-start.md:102` / `docs/DEPLOY.md:78`: `ufw deny 3000/tcp` doesn't filter
  Docker-published ports (Docker's iptables rules bypass ufw); fine while bound to
  127.0.0.1, misleading otherwise. Docs also claim Postgres is bound to 127.0.0.1 —
  its ports block is commented out entirely (which is better).
- `docs/DEPLOY.md:29-31`: instructs setting `DATABASE_URL` in `.env`, but
  `docker-compose.yml:33` constructs it itself — the value is never used.
- App container has no healthcheck in either compose file despite
  `/api/mcp/health` existing.

---

## Verified clean (no action needed)

- No auth bypasses or cross-user leaks: `userId` filtering present in every MCP tool,
  resource, prompt fetcher, and API route reviewed.
- No SQL injection: the two raw `sql` fragments (journal FTS, optimistic
  `date_trunc`) are parameterized; entrypoint seed uses tagged templates.
- `timingSafeEqual` bearer comparison; correct 401/WWW-Authenticate; stateless
  transport.
- `optimistic.ts` is a true single-statement compare-and-swap (ms-truncation is a
  deliberate, documented precision fix).
- Schema constraints, cascades, per-day unique indexes, `timestamptz` throughout;
  migrations match `schema.ts`.
- Docker: non-root user, loopback-only binds, `.env*` excluded from image, idempotent
  seed, bounded wait loop, migration failure correctly prevents server start.

## Suggested fix order

1. **C1 + C2** — rewrite `dates.ts` (also resolves the same-day recurrence duplicate
   mechanism in H1 and week math in M9); add non-UTC `TZ` test run to CI.
2. **C3** — guard `/api/wipe-data`.
3. **H1–H4** — task lifecycle (idempotent completion, re-rollover, preserve
   `goal_id`, stop marking rolled tasks done, unify `update_task`/`complete_task`).
4. **M18 + M19** — gate Docker publish on CI; fix drizzle-kit/esbuild fragility.
5. **M1–M4** — data-loss fixes (journal mood/editor, workout transactions, goals GET).
6. **M5–M7** — type drift; extend the drift test to cover value unions/nullability.
7. Remaining mediums, then lows (batch L19/L20 debris+docs sweep together).
