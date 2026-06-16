# Cadence — User-Ability Review (2026-06-15)

> Multi-agent review focused on user ability across three audiences: the dashboard human user, the self-hoster/installer, and the OpenClaw (model-agnostic LLM) MCP consumer. 60 findings verified against the actual code/docs.

## Implementation status

**MCP — done** (branch `mcp-usability-fixes`): 13 of 17 MCP findings fixed across two commits — the save-loop blocker, all three highs, and the safe validation/discoverability items.

**MCP — deferred for later** (4 items; these change the tool contract OpenClaw already calls or add a feature, so they need a heads-up to whoever runs OpenClaw before shipping):
- `exercises` payload as a real array instead of a JSON-encoded string (`tools/workouts.ts`) — *medium*
- `save_insights` shape tightening to a minimal insight-object schema (`tools/insights.ts`) — *low*
- Stronger `expected_updated_at` guidance to nudge concurrency-safe writes by default — *low*
- Instantiate a workout template into a log (optional `template_id` on `log_workout` or a new tool) — *low*

**Dashboard — highs done** (branch `mcp-usability-fixes`): all 8 high-severity dashboard findings fixed — task-rollover wiring, unscrollable active workout, in-progress workout persistence, editable goal status, space status/deadline, calendar error state, icon-button aria-labels, and a discoverable/touch-reachable command palette (plus the dead Cmd+Shift+S shortcut retired). Remaining: 13 medium + 12 low dashboard findings.

**Self-hoster — pending.** See findings below (image-tag + firewall doc fixes are the highest-value, lowest-risk).

## Executive summary

Cadence's three audiences experience sharply different levels of polish. The **MCP/OpenClaw consumer** has the most damaging defect: no generative prompt instructs the agent to save its output, so the entire read→generate→save loop silently produces nothing and the dashboard's agent-fed widgets stay empty forever — a blocker that masks several other prompt/data-keying correctness risks. The **dashboard user** hits multiple built-but-unwired core features (task rollover, goal close-out, space lifecycle fields) plus two hard blockers on mobile (unscrollable active workout, unsaved in-progress workout loss). The **self-hoster** is mostly served well but is steered by docs toward a non-existent/stale image tag and a false-security firewall rule. The three highest-leverage fixes: (1) append explicit save-tool instructions to every generative prompt and echo machine-targeted date keys; (2) wire up the orphaned dashboard features (rollover banner, goal/space status editors) that already have full backend support; (3) correct the image-tag and firewall guidance in README/quick-start so installs don't fail or feel insecure.

## Top priorities (ranked)

| # | Severity | Audience | Issue | File |
|---|----------|----------|-------|------|
| 1 | blocker | mcp | No prompt tells the agent to save output — save loop never closes | prompts/index.ts:428-469,711-773 |
| 2 | high | mcp | create_journal_entry silently overwrites entire entry (destructive upsert) | tools/journal.ts:193-243 |
| 3 | high | dashboard | Task rollover completely unreachable from UI; undone past tasks vanish | tasks/TaskList.tsx |
| 4 | high | dashboard | Active workout view not scrollable — can't reach Finish on long workouts | workouts/WorkoutDashboard.tsx:73 |
| 5 | high | dashboard | In-progress workout has no persistence — refresh/cancel loses all sets | workouts/WorkoutLogger.tsx:24 |
| 6 | high | dashboard | Goals can never be marked Completed/Abandoned from UI | goals/GoalFormModal.tsx |
| 7 | high | dashboard | Space status & deadline cannot be set/changed — no editor | spaces/SpaceFormModal.tsx |
| 8 | high | self-hoster | Docs point to wrong/frozen image tag (`:v1` 404s, `:1` strands on old major) | README.md:53 |
| 9 | high | mcp | weekly_review never surfaces week_start for the required save arg | prompts/index.ts:723 |
| 10 | high | mcp | daily_planning advertises calendar data it never fetches → hallucinated schedule | prompts/index.ts:383 |
| 11 | high | dashboard | Calendar fetch failure shows misleading "No data available", no retry | calendar/CalendarView.tsx:34-49 |
| 12 | high | dashboard | Icon-only nav/close buttons have no accessible names | calendar/CalendarView.tsx; DateNavigation.tsx; DayDetailPanel.tsx |
| 13 | high | dashboard | Command palette undiscoverable and unreachable on touch devices | layout/ProtectedLayoutClient.tsx:59 |
| 14 | medium | self-hoster | README firewall rule contradicts docs ("ufw doesn't work on Docker ports") — false security | README.md:45 |
| 15 | medium | self-hoster | Briefing/review date keys depend on container TZ — off-by-one vs local 7am cron | dates.ts:18-25 |

## Findings by audience

### Dashboard user

**Task rollover is completely unreachable from the UI** — high — `src/components/tasks/TaskList.tsx`
Impact: A headline task feature is fully orphaned; undone past-dated tasks silently disappear from the daily view.
Fix: Mount `TaskRolloverBanner` (already built) in `TaskList` when the selected date is today and a rollover count exists; wire `onRollover` to POST `/api/tasks/rollover` and refresh. Backend + component already work — only wiring is missing.

**Active workout view is not scrollable** — high — `src/components/workouts/WorkoutDashboard.tsx:73`
Impact: On a multi-exercise workout the user cannot reach lower exercises or the Finish/Save button — they literally cannot complete or save the workout (matches the known PWA scroll bug).
Fix: Wrap the `activeWorkout` branch in the same `flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0` container the list view uses, then the existing inner `max-w-2xl` div.

**In-progress workout has no persistence** — high — `src/components/workouts/WorkoutLogger.tsx:24`
Impact: A refresh, back gesture, PWA kill, or mis-tapped X discards an entire multi-minute logging session with no warning and no recovery.
Fix: Mirror logger state to localStorage on change and restore on mount (like `useFocusTimer`), and guard Cancel/X with a "Discard this workout?" confirm when exercises have data.

**Goals can never be marked Completed or Abandoned from the UI** — high — `src/components/goals/GoalFormModal.tsx`
Impact: The Completed/Abandoned tabs stay permanently empty; finished goals clutter Active forever. Backend supports the transitions fully.
Fix: Add a status action (Mark complete / Abandon / Reactivate) in `GoalDetail` or a status selector in `GoalFormModal` that PATCHes `{ status }`.

**Space status and deadline cannot be set or changed** — high — `src/components/spaces/SpaceFormModal.tsx`
Impact: Setter-less `useState` (lines 17-18) means new spaces are stuck at `active` with no deadline; Paused/Completed filter chips never match anything; the deadline UI is decorative.
Fix: Add a status select and deadline date input with real setState handlers. API, type, and rendering already support both.

**Calendar fetch failure renders misleading "No data available"** — high — `src/components/calendar/CalendarView.tsx:34-49,150-164`
Impact: On a 500/DB-down/network drop the user sees an intentional-looking empty state with no error text and no retry — can't distinguish broken backend from a quiet day.
Fix: Add an `error` state set on `!res.ok` or non-abort catch; render an error message + Retry that re-runs `fetchMonth`. Reserve "No data available" for genuinely empty grids.

**Icon-only navigation and close buttons have no accessible names** — high — `src/components/calendar/CalendarView.tsx:109-128`; `src/components/shared/DateNavigation.tsx:27-45`; `src/components/calendar/DayDetailPanel.tsx:42-48`
Impact: Screen-reader users hear "button" for prev/next month, prev/next week, and the day-detail close — they can't navigate time periods or dismiss the panel.
Fix: Add explicit `aria-label`s ("Previous month"/"Next month", "Previous week"/"Next week", "Close").

**Command palette is undiscoverable and unreachable on touch devices** — high — `src/components/layout/ProtectedLayoutClient.tsx:59`
Impact: `toggleCommandPalette` is wired only to Cmd+K; no visible trigger anywhere. On phones/tablets (no keyboard) the palette and its quick actions are 100% inaccessible.
Fix: Add a visible search/⌘K button in the desktop sidebar header and a search icon in the mobile BottomNav/header, wired to `toggleCommandPalette`.

**Async fetch failures never reach the ErrorBoundary** — medium — `src/components/layout/ProtectedLayoutClient.tsx:80`
Impact: The single layout-level boundary gives a false sense of coverage; the most common failure (API/DB down) yields silent empty screens, not actionable errors.
Fix: Standardize a per-view error state (see calendar/review findings); optionally surface fetch failures via the existing Toast system.

**Weekly Review collapses fetch errors into the empty state, blaming OpenClaw** — medium — `src/components/review/WeeklyReview.tsx:32-43`
Impact: A 500/network drop tells the user the agent hasn't written a review yet — actively misleading; a self-hoster chases OpenClaw instead of the real API/DB fault.
Fix: Only show the OpenClaw empty-state on a genuine 200-with-no-content; on `!res.ok`/non-abort catch show an error state with status + retry.

**Dashboard does not refresh after Daily Start completes a task** — medium — `src/components/dashboard/DailyStartCard.tsx:31`
Impact: After completing the top task, the Tasks widget counts/progress bar stay stale until a full reload — looks like the action was ignored.
Fix: Refetch `/api/dashboard` after a successful PATCH (lift a `reload()` from `Dashboard`); add a success toast.

**Deleting a task or goal is instant with no confirmation or undo** — medium — `src/components/tasks/TaskList.tsx`
Impact: A single mis-click on the hover trash icon irreversibly deletes a task or an entire goal (with progress history and links). Inconsistent with spaces, which confirm.
Fix: Add a confirm for goal deletion (match the space pattern); for tasks add a confirm or an Undo in the toast (`handleDelete` already retains the object for revert).

**Deleting a habit or workout log is instant with no confirmation** — medium — `src/components/habits/HabitTracker.tsx:187`
Impact: Deleting a habit destroys all history/streaks; the mobile trash icon is always-visible next to edit, so a mis-tap wipes months of data with no undo.
Fix: Add a confirm (or toast undo) before deleting a habit and a workout log, matching the journal pattern; warn that habit deletion removes all logged history.

**Date navigation has no upper bound — future habits/journal logging** — medium — `src/components/shared/DateNavigation.tsx:17`
Impact: Users can mark habits "done" for future days; future-dated rows count toward nothing (reads as a bug) and the agent later reads them.
Fix: Clamp forward navigation to today (disable the next chevron when `date >= today` or pass a `maxDate`) for habits and journal.

**Focus session completion gives no reliable signal when backgrounded** — medium — `src/hooks/useFocusTimer.ts:46`
Impact: The intended workflow (start timer, switch apps) yields no reliable signal — Web Audio is throttled in hidden tabs and the toast renders only in-app; the break has already auto-started.
Fix: Request Notification permission and fire a system notification on completion (optionally flash `document.title`), in addition to the beep and toast.

**Goal linking is hidden and one-directional** — medium — `src/components/goals/GoalPicker.tsx`
Impact: `GoalPicker` returns null when no goals exist (field invisible on the task form); `GoalDetail` linked lists are read-only, so you can't add a task from the goal you're viewing.
Fix: Add an "Add task"/"Link existing" action in `GoalDetail` (prefill `goal_id`, mirroring `SpaceDashboard`'s `defaultSpaceId`); optionally keep the Goal field visible-but-disabled with a hint when no goals exist.

**Recurrence is set on a task but never shown afterward and has no stop control** — medium — `src/components/tasks/TaskItem.tsx`
Impact: A headline feature is invisible after creation — you can't tell a recurring task from a one-off, audit which regenerate, or find a "stop recurring" affordance.
Fix: Render a small recurrence badge/icon in `TaskItem` (mirror the rolled-from badge) with the cadence in a tooltip.

**Settings tab buttons hide their label on mobile with no accessible name** — medium — `src/components/settings/Settings.tsx:39-54`
Impact: Screen-reader users on mobile hear three unlabeled buttons and can't tell Account from Preferences from the destructive Danger Zone.
Fix: Add `aria-label={tab.label}` (and `title`); add `role="tablist"`/`"tab"` + `aria-selected`/`aria-controls`.

**Form controls suppress the focus outline** — medium — `src/components/settings/DangerZoneTab.tsx:194`; `AccountTab.tsx:101`; `PreferencesTab.tsx:33-41`
Impact: Keyboard users can't see which control is focused — including the high-stakes wipe-confirmation input (WCAG 2.4.7 failure).
Fix: Replace bare `focus:outline-none` with a visible `focus-visible:ring-2 ring-[var(--accent-primary)]` on all inputs, selects, and the theme/tab buttons.

**Calendar day cells lack grid semantics, per-day labels, and keyboard nav** — medium — `src/components/calendar/CalendarDayCell.tsx:81-119`; `CalendarGrid.tsx:45-63`
Impact: A screen-reader user hears "15, button" with no month/year or activity context; the selected day is announced like any other; no arrow-key navigation between days.
Fix: Give each cell an `aria-label` (full date + activity summary), set `aria-pressed`/`aria-selected` for the selected day, consider `role=grid` with roving focus.

**Cmd+Shift+S "focus sidebar search" is a dead action** — medium — `src/components/layout/ProtectedLayoutClient.tsx:33`
Impact: The shortcut forces the sidebar open and dispatches an event nobody listens to; there's no search field in the sidebar — a confusing no-op.
Fix: Remove the shortcut and the `focus-sidebar-search` dispatch, or repoint it at the command palette. Consolidate on one search entry point.

**ErrorBoundary leaks raw error text and offers only a same-state retry** — low — `src/components/ErrorBoundary.tsx:33-35,58-60`
Impact: On a real crash the user sees a cryptic technical string and a Try Again that re-throws for deterministic errors, with no other escape.
Fix: Show a generic message (raw text behind a collapsible/dev-only "details") and offer `window.location.reload()` or a link to `/dashboard`.

**Reordering tasks across priority groups is silently blocked** — low — `src/components/tasks/TaskList.tsx`
Impact: Dragging an A task into the B section shows a drop indicator, then nothing happens — looks like a bug.
Fix: Suppress the drag-over highlight for a different priority group, or show a brief toast ("Drag within a priority group; use Edit to change priority").

**Pinch-to-zoom disabled app-wide** — low — `src/app/layout.tsx:30`
Impact: Low-vision users can't zoom any screen (WCAG 1.4.4), compounded by many small labels.
Fix: Drop `maximumScale: 1` and `userScalable: false`; solve the iOS input-zoom annoyance by ensuring inputs use ≥16px font instead.

**Full sidebar (theme toggle / display name) unreachable on mobile** — low — `src/components/layout/Sidebar.tsx:101`
Impact: The only reveal path is the dead Cmd+Shift+S; the quick theme toggle is sidebar-only, so mobile users must go Settings → Preferences.
Fix: Retire the unreachable mobile slide-in (or add a header menu button) and surface a theme toggle on mobile (e.g. in the More sheet).

**Toasts can be hidden behind the mobile bottom nav and More sheet** — low — `src/components/shared/Toast.tsx:61`
Impact: On phones with a home-indicator safe-area, action-feedback toasts can be partially occluded by the nav or fully hidden under the `z-[70]` More sheet.
Fix: Offset the container above the nav with `calc(60px + env(safe-area-inset-bottom))` and raise its z-index above the nav/More sheet.

**Daily Briefing markdown uses Tailwind `prose` classes but Typography plugin isn't installed** — low — `src/components/dashboard/DailyBriefing.tsx:61`
Impact: Agent briefings with headings/lists/bold render as cramped flat text; `prose`/`prose-sm` are no-ops (no `@tailwindcss/typography` dep, no `@plugin` in globals.css).
Fix: Add `@plugin "@tailwindcss/typography";` + the dep, or replace `prose` with explicit theme-aware element styling.

**Task priority sub-rank (1/2/3) and bare priority code are unexplained** — low — `src/components/tasks/TaskFormModal.tsx`
Impact: New users see opaque sub-ranks like "B2" and a bare "B1" badge with no legend for the number (the A/B/C → Must/Should/Nice mapping is already conveyed by the column/group headers).
Fix: Add a short tooltip explaining 1/2/3 is sub-rank within a priority; consider showing the human label near the bare code.

**Goal target date renders as a raw ISO string** — low — `src/components/goals/GoalDetail.tsx:119`
Impact: Detail view shows a machine date while the rest of the app localizes — feels unfinished.
Fix: Format with the same locale formatting used elsewhere; consider the days-left/overdue affordance from `GoalItem`.

**Habit completion-rate/streak badges hidden at 0 leave an ambiguous stats column** — low — `src/components/habits/HabitRow.tsx:79`
Impact: A 0% habit shows no metric — ambiguous whether loading, new, or genuinely zero.
Fix: Show a muted "0% • 0d" placeholder so the column is never ambiguously empty.

**Journal mood-only entries can't be recorded** — low — `src/components/journal/JournalEditor.tsx:98`
Impact: Selecting a mood with no text highlights the button (positive feedback) but never persists — the mood is silently lost.
Fix: Relax the `content.trim()` gate to allow a mood-only save, or indicate text is required first.

**Quick Workout Finish button sits disabled with no explanation** — low — `src/components/workouts/WorkoutLogger.tsx:110`
Impact: Quick Start begins with zero exercises; tapping the greyed-out Finish does nothing, unexplained.
Fix: Show a hint ("Add at least one exercise") near the disabled button or an inline empty hint in the logger body.

**Wipe confirmation is case/whitespace-sensitive with no hint** — low — `src/components/settings/DangerZoneTab.tsx:6,193,227-228`
Impact: Typing "Wipe All Data" or a trailing space leaves the button dead with no feedback — looks broken.
Fix: Compare `confirmText.trim().toLowerCase()`; show an inline hint when text is present but not matching. (Server independently requires `{confirm:"WIPE"}`, so loosening the client check is safe.)

### Self-hoster / installer

**Docs point self-hosters at the wrong/frozen major image tag** — high — `README.md:53`; `docs/quick-start.md:175`
Impact: `:v1` is never published (semver action uses no `v` prefix) → manifest-not-found on first `docker compose up`, install looks broken. `:1` exists but only floated within v1.x → silently strands the user a full major behind (project is on 2.2.0/`:2`).
Fix: Replace `:v1`/`:1` with `:2` (current major), or ship the example as `:latest` with a note to pin to the current major shown on GHCR. The semver action never prefixes `v`, so `:v*` forms are always wrong.

**README firewall guidance contradicts the docs' own "ufw doesn't work on Docker ports" warning** — medium — `README.md:45`
Impact: A self-hoster adds a `ufw deny 3000` rule, believes the no-auth dashboard is protected, and gains a false sense of security — the rule is a no-op against the Docker-published port.
Fix: Fix README.md:45 to match quick-start/DEPLOY: rely on the `127.0.0.1`/Tailscale-IP bind, not a port-3000 firewall rule. Remove the "firewall rule on port 3000" phrasing.

**Briefing/review date keys depend on container timezone** — medium — `src/lib/dates.ts:18-25`; `prompts/index.ts:444,723`; `tools/briefings.ts:93`
Impact: Containers default to UTC; if OpenClaw fires at local 7am west of UTC, `getToday()` can report the previous calendar day, keying the briefing under the wrong date so the read tools/widget don't find it. Silent and intermittent.
Fix: Set the container TZ to the user's timezone in compose (document a `TZ` env var), or have OpenClaw always pass an explicit `briefing_date`/`week_start` in the user's TZ. Document this.

**POSTGRES_PASSWORD is "Recommended" with a working default** — medium — `.env.example:14-17`
Impact: The stack boots with known `changeme`/`cadence` credentials if skipped; if the user later uncomments the 5432 bind (the file invites it) or shares the DB network, credentials are trivially known. The "three values" vs "Recommended" inconsistency is the root confusion.
Fix: Promote `POSTGRES_PASSWORD` to "Required" and ship it blank so a missing value fails loudly. Align `.env.example` framing with quick-start's "three values".

**Daily Briefing and Insight cards silently vanish with no explanation** — medium — `src/components/dashboard/DailyBriefing.tsx:47`; `InsightCards.tsx:76`
Impact: A fresh self-hoster who hasn't wired/triggered OpenClaw sees prominent skeletons resolve to empty space — no indication whether broken, loading, or waiting on the agent.
Fix: Render a lightweight placeholder when empty ("No briefing yet — your agent posts the morning briefing here once it runs"), same for `InsightCards`, turning dead space into a discoverable explanation of the agent integration.

**Undocumented CLI prerequisites (`jq`, `curl`, `openssl`, `uuidgen`)** — low — `docs/quick-start.md:5-9`
Impact: At the `curl ... | jq` verification gate, a minimal host without jq fails with "jq: command not found" — a healthy stack looks broken at the moment of confirmation.
Fix: Add `jq` (note `uuidgen` ships with util-linux) to prerequisites, or make verification jq-optional (raw `curl -s` primary, `| jq` a nicety). Mirror the python-uuid resilience already in `.env.example`.

**Changing SELF_HOSTED_USER_ID after first boot silently orphans prior data** — low — `docker-entrypoint.sh:43-58`
Impact: Regenerating the UUID inserts a second profile row and shows empty data with no error; prior data remains under the old id.
Fix: Document "SELF_HOSTED_USER_ID is permanent — changing it orphans existing data." Optionally log a warning when seeding a new profile while other profile rows exist.

**Update commands diverge between prebuilt and from-source paths with no cross-guidance** — low — `docs/DEPLOY.md:110-116`
Impact: A user mixing install paths can run the wrong update (e.g. `docker compose pull` against a from-source build with no app `image:`) and see "I pulled but nothing changed".
Fix: State explicitly in each doc which command matches which compose file (prebuilt `image:` → `pull`; from-source `build:` → `up -d --build app`).

**Health-check example shows a stale hardcoded version (`0.1.0`)** — low — `docs/quick-start.md:73-82`
Impact: First run reports `"version": "2.2.0"` vs the documented `0.1.0`; a careful self-hoster may briefly wonder if they pulled the wrong image (the tools/prompts/resources counts are correct).
Fix: Drop the hardcoded `version` from the example (or use a placeholder). The 45/13/15 counts are accurate and can stay.

**Compose example header says "Copy this file to docker-compose.yml" but quick-start already curls it to that name** — low — `docs/quick-start.md:109-116`
Impact: A user opening the downloaded `docker-compose.yml` reads a top comment telling them to copy it to `docker-compose.yml` — contradictory, may second-guess setup.
Fix: Strip the "Copy this file" Usage block from `docker-compose.example.yml`, or curl it to `docker-compose.example.yml` + add an explicit `cp` step.

### MCP / OpenClaw consumer

**No prompt tells the agent to save its output via a write tool** — blocker — `src/lib/mcp/prompts/index.ts:428-469` (morning_briefing), `:711-773` (weekly_review)
Impact: A literal-following LLM generates and delivers the briefing/review, then stops — nothing persists. `save_*` tools exist but no prompt names them (`grep save_` over prompts = 0 hits). The read-only DailyBriefing/WeeklyReview/InsightCards widgets stay permanently empty with no error. The core "dashboard reads what OpenClaw saves" design silently fails.
Fix: Append an explicit save instruction to every generative prompt naming the exact tool and args, e.g. morning_briefing: "After composing the briefing, call `save_daily_briefing` with `content` set to your full briefing text (briefing_date defaults to today)"; weekly_review: "Then call `save_weekly_review` with `week_start`=<the date shown above> and `content`=<your review>".

**create_journal_entry silently overwrites the whole entry** — high — `src/lib/mcp/tools/journal.ts:193-243`
Impact: `onConflictDoUpdate` fully replaces `content` (line 110); an agent told to "add a note to today's journal" wipes prior content. The verb "create"/"or update" misleads the model into thinking the call is additive.
Fix: Lead the description with a warning ("Replaces the entire content for that date — read the existing entry first and concatenate if appending"). Consider an `append_mode` flag or split into create vs append tools.

**weekly_review resolves week_start internally but never surfaces it for the required save arg** — high — `src/lib/mcp/prompts/index.ts:723`; `tools/reviews.ts:100`
Impact: The agent sees a date in prose but isn't told the exact `YYYY-MM-DD` must be passed back; it can mis-key (Sunday vs Monday-based `startOfWeek`) so `get_weekly_review` and the widget never find the review.
Fix: Echo a machine-targeted line interpolating `weekStart` verbatim: "When saving, call `save_weekly_review` with `week_start` exactly equal to \"2026-06-15\"".

**daily_planning advertises calendar data but never fetches any** — high — `src/lib/mcp/prompts/index.ts:383,391-395,401-417`
Impact: The description promises "calendar" and asks for a "time-blocked schedule" but only tasks/habits/goals are fetched — no availability source exists anywhere (`cadence://calendar/today` is a day-summary aggregate, not timed events). A smaller LLM will hallucinate meetings and free blocks.
Fix: Drop "calendar" from the description and soften "time-blocked schedule" to "a suggested ordering of tasks" so the prompt matches the data it provides.

**Generative prompts ship empty JSON arrays with no "if no data, say so" guard** — medium — `src/lib/mcp/prompts/index.ts:404-410,595-608,843-856`
Impact: Smaller models (the model-agnostic target) fabricate plausible habits/workouts to satisfy unconditional numbered directives even when arrays are `[]`; output looks real but is invented and, once save tools are wired, persists garbage.
Fix: Add a one-line guard to each generative prompt: "If the data above is empty, do not invent anything — say there is no data yet and suggest the user add some."

**Raw Postgres errors leak to the agent for bad FK IDs** — medium — `src/lib/mcp/tools/tasks.ts:84-86`; `schema.ts:150-151`
Impact: `space_id`/`goal_id`/`task_id` are `z.string()` (not `.uuid()`); a non-UUID or stale ID returns an opaque "invalid input syntax for type uuid" / FK-violation string the agent can't self-correct from. `start_focus_session` passes `task_id` through with no existence check.
Fix: Validate id params with `z.string().uuid()` so a clean Zod error fires pre-DB; translate FK-violation catches into "space_id <x> does not exist".

**exercises payload is a JSON-encoded STRING** — medium — `src/lib/mcp/tools/workouts.ts:392-394,417-419,445-447`
Impact: `log_workout`/`create_workout_template`/`update_workout_log` declare `exercises` as `z.string()` parsed via `JSON.parse`; models frequently pass a raw array (fails Zod) or double-escape it → avoidable "Invalid exercises JSON format" round-trips. A validated `exerciseEntrySchema` already exists but is applied post-parse.
Fix: Make `exercises` a `z.array(exerciseEntrySchema)` so it self-documents and the model passes structured data directly; if a string must stay, echo parse position + a valid example in the error.

**workout_suggestion asks for analysis the data cannot support** — medium — `src/lib/mcp/prompts/index.ts:224-237,239-268,843-856`
Impact: Queries return only exercise names + durations (no muscle group/sets/reps/weight), yet the prompt asks to identify muscle groups, judge recovery, and include sets/reps — the model must guess from name strings; on weak models recovery advice becomes noise.
Fix: Enrich the queries with sets/reps and any muscle-group metadata, or reframe directives as best-effort ("Infer likely muscle groups from exercise names where possible").

**get_daily_briefing and get_insights are today-only while their save counterparts accept any date** — low — `src/lib/mcp/tools/briefings.ts:54-76`; `insights.ts:59-80`
Impact: An agent asked "what was yesterday's briefing?" can't read it — it can write arbitrary dates but read only today.
Fix: Add an optional `date` param (defaulting to today) to `get_daily_briefing` and `get_insights`, mirroring the journal/workouts read tools.

**complete_task and update_task(done:true) are redundant paths** — low — `src/lib/mcp/tools/tasks.ts:212-317`
Impact: An LLM picking tools cold has two equally-valid choices for "mark done"; minor decision overhead, no data risk.
Fix: Have each description state the canonical choice (complete_task preferred for simple completion; update_task only when also changing other fields).

**Generic "Task ID"/"Habit ID" descriptions give no hint where IDs come from** — low — `tasks.ts:217,274,324`; `habits.ts:180,252,302`; `goals.ts:171,216`; `focus.ts:214`
Impact: A cold-reading LLM must infer that `session_id` comes from `get_focus_sessions`, etc. — minor wrong-tool fishing.
Fix: Add the source to each `describe()`, e.g. "Task ID (from list_tasks)".

**expected_updated_at is opt-in everywhere — default write path is last-write-wins** — low — `tasks.ts:215,222`; `habits.ts:250,257`; `goals.ts:169`; `journal.ts:195`; `focus.ts:212`
Impact: An agent that reads then writes without the token can silently clobber a concurrent dashboard edit; the opt-in framing means most calls skip it.
Fix: Strengthen guidance ("If you read this record this session, pass its `updated_at` to avoid overwriting a concurrent edit") and return `updated_at` prominently to nudge reuse.

**save_insights accepts both array and object, weakening read-shape guidance** — low — `src/lib/mcp/tools/insights.ts:10-13,83-89`
Impact: An agent can save a structurally valid but unrenderable payload because the write tool enforces no per-object fields, while InsightCards reads back a specific shape.
Fix: Define a minimal insight-object shape (e.g. `{title, detail}`) as `z.array` of that object, keeping prose fields as plain strings (per the "schema metadata strictly" rule).

**target_days meaning for frequency:"weekly" is undocumented** — low — `src/lib/mcp/tools/habits.ts:204-208,260-264`
Impact: `getHabitStats` ignores `frequency` and keys entirely off `target_days`; an agent creating a weekly habit can't tell what to put there, risking wrong streak/completion semantics.
Fix: Document the exact interaction in `describe()` (for daily, target_days are expected weekdays; state what weekly does — stats currently treat each target_day as expected regardless of frequency).

**Workout templates cannot be instantiated into a log** — low — `src/lib/mcp/tools/workouts.ts:383-408`
Impact: An agent that listed templates and wants to "log today's Push Day" must re-type every exercise — defeating templates and risking transcription drift.
Fix: Add an optional `template_id` to `log_workout` that copies the template's exercises + sets the FK, or add a `start_workout_from_template` tool.

**goal_planning returns a bare user-role "Goal not found" a model may answer instead of erroring** — low — `src/lib/mcp/prompts/index.ts:880-884`
Impact: A weaker model may treat "Goal not found" as a conversational statement and hallucinate a plan rather than reporting the bad `goal_id`.
Fix: Make the failure unambiguous: "ERROR: No goal exists with id <goal_id>. Do not generate a plan; report this to the user." Apply to any not-found path.

**Resource description says "AI-generated", leaking an AI assumption** — low — `src/lib/mcp/resources/briefings.ts:11`
Impact: Negligible runtime; minor inconsistency in metadata the agent sees, contradicting the "knows nothing about AI" design.
Fix: Reword to "Today's saved daily briefing, if one exists." Keep descriptions provider-neutral and about the data, not its origin.

## Quick wins

- Append the save-tool instruction (and verbatim date key) to `morning_briefing`/`weekly_review`/insights prompts — closes the blocker save loop and the week_start mis-keying with prompt-text edits only (no code).
- Add a one-line "if data is empty, don't invent" guard to the three generative prompts.
- Mount the already-built `TaskRolloverBanner` in `TaskList` and wire it to the existing rollover API.
- Wrap the active-workout branch in the standard `flex-1 overflow-y-auto` container — one-line fix for the unscrollable-workout blocker.
- Fix `README.md:53` (`:v1`/`:1` → `:2` or `:latest` + pin note) and `README.md:45` (drop the port-3000 firewall claim).
- Add `aria-label`s to the calendar/date-nav/close icon buttons and `aria-label`s to the Settings tab buttons.
- Drop the hardcoded `version: 0.1.0` from the quick-start health-check example; add `jq` to the prerequisites list.
- Change `prose` placeholders: add `@plugin "@tailwindcss/typography";` so agent briefings render with structure.
- Lead `create_journal_entry`'s description with the "replaces entire content" warning.
- Drop "calendar" from the `daily_planning` description so it stops promising data it never fetches.
- Add `confirm()` to habit/workout-log/goal deletes to match the existing journal/space pattern.
- Render empty-state placeholder copy in `DailyBriefing`/`InsightCards` instead of `return null`, so fresh self-hosters understand the agent integration.
