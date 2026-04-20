# MCP reference

34 tools across 11 domains, plus 13 prompt templates and a handful of read-only resources. All served from `POST /api/mcp` over [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), stateless, authenticated by `Authorization: Bearer <MCP_API_KEY>`.

!!! note "Validation rules"
    Every constrained field is validated **twice** — once by the tool's Zod schema (at the transport layer) and again by a Postgres `CHECK` constraint (at the DB). Rules are kept in sync via `src/lib/mcp/tools/validators.ts`.

## Shared value formats

| Field kind | Format | Examples |
|---|---|---|
| Date | `YYYY-MM-DD` | `2026-04-20`, `2026-12-31` |
| Task priority | `[A-C][1-9]` | `A1` (critical, top), `B3`, `C9` — letter = category, digit = sub-ordering |
| Habit frequency | `daily \| weekly` | — |
| Habit target days | ISO weekday ints `1-7` | `[1,2,3,4,5]` = weekdays (Mon=1, Sun=7) |
| Goal category | enum | `health`, `career`, `personal`, `financial`, `learning`, `relationships`, `other` |
| Goal status | enum | `active`, `completed`, `abandoned` |
| Space status | enum | `active`, `paused`, `completed` |
| Mood | int `1-5` | 1 = low, 5 = great |
| Exercise type | enum | `strength`, `timed`, `cardio` |
| Focus duration | int `1-480` min | — |
| Focus break | int `0-120` min | — |

---

## Tasks

### `list_tasks`

List tasks for a given date (defaults to today). Incomplete tasks from previous days are automatically included when viewing today — no need to pull overdue separately.

| Arg | Type | Required | Notes |
|---|---|---|---|
| `date` | date | no | Defaults to today |
| `space_id` | UUID | no | Filter by space/project |

### `create_task`

Create a new task.

| Arg | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `notes` | string | no | |
| `priority` | priority | no | Defaults to `B1` |
| `task_date` | date | no | Defaults to today |
| `space_id` | UUID | no | |
| `goal_id` | UUID | no | |

### `update_task`

| Arg | Type | Required |
|---|---|---|
| `task_id` | UUID | yes |
| `title`, `notes`, `priority`, `task_date`, `done` | varies | no |

### `complete_task`

Mark a task done. Argument: `task_id` (UUID).

### `delete_task`

Delete permanently. Argument: `task_id` (UUID).

---

## Habits

### `list_habits`

Argument: `include_archived?: boolean` (default false).

### `get_habit_stats`

Completion statistics for a habit.

| Arg | Type | Required | Notes |
|---|---|---|---|
| `habit_id` | UUID | yes | |
| `days` | int | no | Defaults to 30 |

### `create_habit`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `description` | string | no | |
| `frequency` | `daily \| weekly` | no | Defaults to `daily` |
| `target_days` | `int[1-7][]` | no | ISO weekdays. Default: `[1..7]` |
| `color` | hex string | no | |

### `toggle_habit`

Idempotent — toggles whether the habit was completed on the given date.

| Arg | Type | Required | Notes |
|---|---|---|---|
| `habit_id` | UUID | yes | |
| `date` | date | no | Defaults to today |

---

## Journal

### `get_journal_entries`

Fetch a single day or a date range.

| Arg | Type | Required | Notes |
|---|---|---|---|
| `date` | date | no | If set, returns a single entry |
| `from`, `to` | date | no | If set, returns a range |
| `limit` | int `1-100` | no | Default 10 |

### `search_journal`

Substring search across all entries.

Argument: `query: string`.

### `create_journal_entry`

Upserts — if an entry already exists for that date, it's overwritten.

| Arg | Type | Required |
|---|---|---|
| `content` | string | yes |
| `entry_date` | date | no (defaults today) |
| `mood` | int `1-5` | no |

---

## Workouts

### `list_workout_logs`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `date` | date | no | Single day |
| `from`, `to` | date | no | Range |

If neither is set, returns the most recent 20.

### `list_workout_templates`

No arguments. Returns saved templates with their exercises.

### `log_workout`

Log a completed workout. The `exercises` argument is a **JSON string** containing an array of exercise entries.

| Arg | Type | Required |
|---|---|---|
| `name` | string | yes |
| `log_date` | date | yes |
| `duration_minutes` | int | no |
| `notes` | string | no |
| `exercises` | JSON string | no |

Each exercise entry:

```json
{
  "name": "Squat",
  "type": "strength",
  "sets": 3,
  "reps": 10,
  "weight": 100,
  "duration_seconds": null,
  "notes": "last set was a grinder"
}
```

`type` must be one of `strength`, `timed`, `cardio`. `name` is required on each entry.

---

## Focus sessions

### `get_focus_sessions`

| Arg | Type | Required |
|---|---|---|
| `from`, `to` | date | no (last 30 sessions if unset) |

### `get_focus_stats`

No arguments. Returns today's totals (sessions started, completed, total focus minutes).

### `start_focus_session`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `duration_minutes` | int `1-480` | yes | |
| `task_id` | UUID | no | |
| `break_minutes` | int `0-120` | no | Default 5 |

### `complete_focus_session`

Mark a session complete. Argument: `session_id: UUID`.

---

## Goals

### `list_goals`

Argument: `status?: active | completed | abandoned`.

### `create_goal`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `description` | string | no | |
| `category` | goal category | no | Default `personal` |
| `target_date` | date | no | |

### `update_goal`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `goal_id` | UUID | yes | |
| `title`, `description`, `status`, `progress` | varies | no | `progress` is 0-100 |

### `log_goal_progress`

Just update the progress %.

| Arg | Type | Required |
|---|---|---|
| `goal_id` | UUID | yes |
| `progress` | int `0-100` | yes |

---

## Spaces (projects)

### `list_spaces`

No arguments.

### `create_space`

| Arg | Type | Required |
|---|---|---|
| `name` | string | yes |
| `description` | string | no |

### `update_space`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `space_id` | UUID | yes | |
| `name`, `description` | string | no | |
| `status` | space status | no | `active`, `paused`, or `completed` |

---

## Weekly reviews

### `get_weekly_review`

Argument: `week_start?: date`. If omitted, returns the latest review.

### `save_weekly_review`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `week_start` | date | yes | Monday of the target week |
| `content` | string | yes | Markdown |

Upserts keyed on `(user_id, week_start)`.

---

## Daily briefings

### `get_daily_briefing`

No arguments. Returns today's briefing, or `{ message: "No briefing saved for today." }` if none exists.

### `save_daily_briefing`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `briefing_date` | date | no | Defaults to today |
| `content` | string | yes | Markdown |

Upserts keyed on `(user_id, briefing_date)`.

---

## Insights

### `get_insights`

No arguments. Returns today's cached insights, or `{ message: "No insights saved for today." }`.

### `save_insights`

| Arg | Type | Required | Notes |
|---|---|---|---|
| `cache_date` | date | no | Defaults to today |
| `insights` | array or object | yes | Must be JSON-serializable; cannot be null |

---

## Calendar / summary

### `get_day_summary`

Comprehensive rollup for a single day: tasks (with rollover), completed habits, journal entry, workouts, focus stats.

Argument: `date?: date` (defaults today).

### `get_week_summary`

Aggregate stats for a week: task completion rate, total habit completions, workout count + total minutes, focus minutes + session count, average mood.

Argument: `week_start?: date` (defaults to current week's Monday).

---

## Prompt templates

Prompts are loaded via MCP's `prompts/get` endpoint and returned as ready-to-fill message templates. OpenClaw's typical pattern: load the prompt → pull fresh data with read tools → generate against it → save the result with the matching write tool.

| Name | Purpose |
|---|---|
| `daily_planning` | Plan today |
| `morning_briefing` | Daily briefing (pair with `save_daily_briefing`) |
| `end_of_day_review` | End-of-day reflection |
| `weekly_review` | Weekly review structure (pair with `save_weekly_review`) |
| `weekly_trends` | Trend analysis over a week |
| `productivity_report` | Stats + narrative |
| `habit_analysis` | Habit consistency deep-dive |
| `goal_check_in` | Per-goal progress check-in |
| `goal_planning` | Set up a new goal |
| `space_planning` | Plan a project/space |
| `week_planning` | Plan the upcoming week |
| `journal_prompt` | Journaling starter for today |
| `workout_suggestion` | Suggest a workout from recent history |

---

## Resources

Read-only URIs under the `dailyagent://` scheme. Use these for fast contextual reads when calling a tool would be overkill.

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

---

## Error model

All tool errors come back as `text/plain` content starting with `Error: ` and the Postgres or validation message. Common categories:

- **Validation errors** — Zod schema rejection. The message names the field and expected format.
- **CHECK constraint failures** — DB-level rejection. Surfaces the Postgres error message; usually means the tool schema and DB constraint got out of sync (shouldn't happen with current `validators.ts`, but file a bug if it does).
- **Not found** — e.g. `Task not found` when updating/completing a task that doesn't exist or belongs to a different user.
- **Unauthorized** — missing or wrong bearer token. HTTP 401 before the tool even runs.
