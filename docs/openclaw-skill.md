---
name: dailyagent
description: Productivity data layer. Call the dailyagent MCP server to read and write tasks, habits, journal entries, workouts, focus sessions, goals, spaces, weekly reviews, daily briefings, and insights. Use this any time the user mentions any of those.
---

# Daily Agent MCP — OpenClaw Skill

## What this is

`dailyagent` is the user's personal productivity database, exposed as an MCP server. It is the **single source of truth** for:

- **Tasks** (Franklin Covey priority A1-C9, with rollover, spaces, goals, recurrence)
- **Habits** and habit logs
- **Journal entries** (with mood 1-5 and full-text search)
- **Workouts** (templates, logs, per-exercise sets/reps/weight/type)
- **Focus sessions** (Pomodoro-style, optionally linked to a task)
- **Goals** (with progress, categories, target dates)
- **Spaces** (projects/areas that group tasks/goals/habits)
- **Weekly reviews**, **daily briefings**, and **insight cache** (read + write)

The server runs on the user's VPS behind Tailscale. Reads and writes go straight to Postgres. You do **not** store anything locally — always go through the MCP tools.

## Connection

The MCP server is already registered in the user's OpenClaw config as `dailyagent`. You do not need to configure auth — it's handled by the gateway (bearer token in the OpenClaw config). If tool calls fail with 401 / connection errors, stop and tell the user — do not fall back to local files or markdown templates.

## Core rules

1. **Always use MCP tools.** Never invent data, never fall back to scratch notes or file-based tracking. If a tool doesn't exist for what the user wants, say so.
2. **Today's date is authoritative.** When the user says "today," use the current date (YYYY-MM-DD). The server also defaults most date fields to today if omitted.
3. **Tasks roll over.** `list_tasks` with no date returns today's tasks **plus incomplete tasks from previous days**. You don't need to manually pull overdue tasks.
4. **Priority format is `A1`-`C9`.** Letter (A critical / B important / C nice-to-have) + digit 1-9 for sub-ordering. If the user just says "high priority" → use `A1`. If they say "low" → `C1`. Default if unspecified → `B1` (the tool handles this — just omit).
5. **Dates are always `YYYY-MM-DD`.** Parse natural language ("tomorrow", "next Monday") into that format before calling tools.
6. **Writes are authoritative.** Don't ask "should I save this?" — if the user said "log my workout" / "add a task" / "journal this," just do it.

## Tools

### Tasks
- `list_tasks(date?, space_id?)` — today's + overdue if no date; else that specific date
- `create_task(title, notes?, priority?, task_date?, space_id?, goal_id?)` — priority `A1`-`C9`, defaults to B1
- `update_task(task_id, title?, notes?, priority?, task_date?, done?)`
- `complete_task(task_id)`
- `delete_task(task_id)`

### Habits
- `list_habits(include_archived?)`
- `get_habit_stats(habit_id, days?)` — default 30 days
- `create_habit(name, description?, frequency?, target_days?, color?)` — frequency `daily|weekly`; target_days ISO 1-7 (Mon=1, Sun=7)
- `toggle_habit(habit_id, date?)` — idempotent toggle; defaults to today

### Journal
- `get_journal_entries(date?|from?,to?, limit?)` — specific day or a range
- `search_journal(query)` — substring search
- `create_journal_entry(content, entry_date?, mood?)` — mood 1-5; upserts if entry for that date exists

### Workouts
- `list_workout_logs(date?|from?,to?)` — most recent 20 if no filter
- `list_workout_templates()`
- `log_workout(name, log_date, duration_minutes?, notes?, exercises?)` — `exercises` is a JSON string array; each entry: `{name, type?: "strength"|"timed"|"cardio", sets?, reps?, weight?, duration_seconds?, notes?}`

### Focus
- `get_focus_sessions(from?, to?)`
- `get_focus_stats()` — today's totals
- `start_focus_session(duration_minutes, task_id?, break_minutes?)` — duration 1-480, break 0-120
- `complete_focus_session(session_id)`

### Goals
- `list_goals(status?)` — status `active|completed|abandoned`
- `create_goal(title, description?, category?, target_date?)` — category `health|career|personal|financial|learning|relationships|other`
- `update_goal(goal_id, title?, description?, status?, progress?)` — progress 0-100
- `log_goal_progress(goal_id, progress)` — just the progress percentage

### Spaces (projects)
- `list_spaces()`
- `create_space(name, description?)`
- `update_space(space_id, name?, description?, status?)` — status `active|paused|completed`

### Weekly Reviews
- `get_weekly_review(week_start?)` — latest if omitted
- `save_weekly_review(week_start, content)` — markdown

### Daily Briefings
- `get_daily_briefing()` — today's, if saved
- `save_daily_briefing(briefing_date?, content)` — markdown; defaults to today

### Insights (AI-generated insight cards)
- `get_insights()` — today's cached insights
- `save_insights(cache_date?, insights)` — `insights` must be an array or object

### Calendar / summary
- `get_day_summary(date)` — tasks + habits + journal + workouts + focus for that day
- `get_week_summary(week_start)` — aggregate across a week

## Prompt templates (via MCP prompts)

The server exposes prompt templates you can load for structured outputs. Use these when the user asks for something generative:

- `daily_planning` — plan today
- `morning_briefing` — the daily 7am-style briefing
- `end_of_day_review` — end-of-day reflection
- `weekly_review` — the weekly review structure
- `weekly_trends` — trend analysis over a week
- `productivity_report` — stats + narrative
- `habit_analysis` — habit consistency deep-dive
- `goal_check_in` — per-goal progress check-in
- `goal_planning` — set up a new goal
- `space_planning` — plan a project/space
- `week_planning` — plan out the upcoming week
- `journal_prompt` — journaling starter for today
- `workout_suggestion` — suggest a workout based on recent logs

Pattern: load the prompt → fill it with fresh data (call the read tools) → generate → save the result with the matching save tool (e.g. `save_daily_briefing`, `save_weekly_review`, `save_insights`).

### What a loaded prompt looks like

When you call a prompt, the server runs the read queries itself and returns a `messages` array of `{role: "user", content: {type: "text", text: "..."}}` entries. You don't need to call `list_tasks` / `list_habits` beforehand — the prompt has already pulled fresh data and embedded it as JSON inside the text. Just generate a response to the returned messages, then call the matching save tool.

Example — loading `morning_briefing` returns a single user message whose text looks roughly like:

```
Good morning! Give me a quick briefing for 2026-04-20.

## What's on My Plate
- 7 tasks pending (2 are A-priority)
- 4 habits to track today
- 3 active goals in progress

### Task Details
[{"id":"...","title":"Ship MCP prompt docs","priority":"A1","done":false,"task_date":"2026-04-20"}, ...]

### Habits
[{"id":"...","name":"Morning walk","completed_today":false}, ...]

Keep it brief: 3-4 bullet points on what matters most today, then a one-sentence motivational close.
```

So the flow is: `prompt_load("morning_briefing")` → you generate the briefing text → `save_daily_briefing({content: "..."})` → deliver. Prompts that take args (`productivity_report`, `weekly_review`, `goal_planning`, `space_planning`) accept them as the prompt arguments, not as a separate tool call.

Prompts with args:
- `productivity_report(from, to)` — both `YYYY-MM-DD`, required
- `weekly_review(week_start?)` — defaults to this week's Monday
- `goal_planning(goal_id)` — resolve the ID via `list_goals` first
- `space_planning(space_id?)` — omit for cross-space planning

All other prompts take no args.

## Resources (read-only URIs)

For quick contextual reads you can fetch resources instead of calling tools:

- `dailyagent://dashboard` — today at a glance
- `dailyagent://tasks/today`, `dailyagent://tasks/overdue`
- `dailyagent://habits/today`, `dailyagent://habits/streaks`
- `dailyagent://journal/today`, `dailyagent://journal/recent`
- `dailyagent://workouts/recent`
- `dailyagent://focus/today`
- `dailyagent://goals/active`
- `dailyagent://spaces/list`
- `dailyagent://briefing/today`
- `dailyagent://calendar/today`, `dailyagent://calendar/week`
- `dailyagent://review/latest`

## Common patterns

**"What's on my list today?"**
→ `list_tasks` with no args. Show them, grouped by priority letter.

**"Add a task: X"**
→ `create_task({title: "X"})`. Don't ask for priority — the default B1 is fine unless the user specifies.

**"Mark X done" / "I finished X"**
→ `list_tasks` → find by title → `complete_task(task_id)`.

**"Log my workout"**
→ Ask for what was done if not stated, then `log_workout` with the exercises array. Include `type` on each exercise (strength/timed/cardio).

**"How am I doing on habits?"**
→ `list_habits` → for each, `get_habit_stats`. Summarize completion rates.

**"Journal for today: ..."**
→ `create_journal_entry({content: "..."})`. If they also mention a mood number, include it.

**"Start a 25 minute focus session on X"**
→ `list_tasks` → find X → `start_focus_session({duration_minutes: 25, task_id})`.

**Morning briefing (7am cron)**
→ Load `morning_briefing` prompt → pull `dashboard` resource → generate → `save_daily_briefing` → deliver to Telegram.

**Weekly review (Sunday evening cron)**
→ Load `weekly_review` prompt → pull `calendar/week` + `get_week_summary` → generate → `save_weekly_review`.

## What NOT to do

- Do **not** create parallel tracking in markdown files, local notes, or templates. The MCP server is the only store.
- Do **not** skip the save step after generating a briefing or review — always persist it via the save tool so the dashboard shows it.
- Do **not** retry failed writes indefinitely. If a tool returns an error, surface it to the user with the error text.
- Do **not** guess IDs. Always resolve a task/habit/goal by listing first, then act on the returned `id`.
