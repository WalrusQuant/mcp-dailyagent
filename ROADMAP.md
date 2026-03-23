# Roadmap — Daily Agent

A productivity dashboard with AI-powered suggestions, plus an MCP server so your AI client (Claude, ChatGPT, Cowork) can manage your data. Two interfaces, one data layer.

**Product positioning:** A genuinely good productivity app on its own — tasks, habits, journal, workouts, focus timer, goals, calendar, weekly reviews. AI suggestions built in via a house model. Connect Claude or ChatGPT via MCP for full AI-powered productivity management. Use the dashboard when you want a visual UI, use your AI client when you want to stay in one place.

**Starting point:** The app exists and works. Dashboard, productivity tools, AI features, admin panel, usage limits — all built. This roadmap adds multi-tenant SaaS infrastructure (open signup, Stripe, MCP server, OAuth) on top of the working product.

---

## Phase 1: Codebase Cleanup ✅

Remove chat, web search, and image generation. Keep everything else.

**Completed 2026-03-22** — 86 files changed, 10,577 lines deleted. Zero TypeScript errors. Merged to main.

### 1.1 — Remove Chat

**Pages to delete:**
- `src/app/(protected)/chat/page.tsx` — Chat landing
- `src/app/(protected)/chat/[id]/page.tsx` — Conversation view
- `src/app/(protected)/history/page.tsx` — Chat history

**Components to delete:**
- `src/components/Chat.tsx` — Main chat interface
- `src/components/Message.tsx` — Message rendering
- `src/components/ModelSelector.tsx` — Model selection popover (users don't choose models)
- `src/components/ToolCallCard.tsx` — Agent tool approval UI
- `src/components/ComposerMenu.tsx` — Chat input menu
- `src/components/ConversationSettings.tsx` — Per-conversation settings
- `src/components/FileUpload.tsx` — Chat file attachment
- `src/components/UsageDisplay.tsx` — Per-message token/cost display
- `src/components/UsageBalance.tsx` — Sidebar usage display
- `src/components/history/ChatHistory.tsx` — Chat history list
- `src/components/search/SearchModal.tsx` — Conversation search
- `src/components/search/SearchResult.tsx` — Search result display

**API routes to delete:**
- `src/app/api/chat/route.ts` — Chat streaming
- `src/app/api/chat/tool-execute/route.ts` — Agent tool execution
- `src/app/api/conversations/route.ts` + all nested routes — Conversation CRUD
- `src/app/api/messages/route.ts` — Message search
- `src/app/api/messages/save/route.ts` — Partial message save
- `src/app/api/search/route.ts` — Conversation search
- `src/app/api/models/route.ts` + `raw/route.ts` — Model management (admin controls this now)

**Libraries to delete:**
- `src/lib/system-prompt.ts` — Chat system prompt
- `src/lib/export.ts` — Conversation export
- `src/lib/model-context.tsx` — Model React context (users don't pick models)

### 1.2 — Remove Image Generation

- `src/app/(protected)/image/page.tsx` — Image generation page
- `src/components/ImageGenerator.tsx` — Image generation UI
- `src/app/api/image/route.ts` — Image generation API
- `src/app/api/images/route.ts` + `[id]/route.ts` — Image storage

### 1.3 — Remove Web Search

- `src/app/api/web-search/route.ts` — Tavily web search
- `src/lib/enhanced-search.ts` — AI-summarized search
- `src/lib/tavily.ts` — Tavily client
- Remove `TAVILY_API_KEY` from env

### 1.4 — Remove Usage Dashboard

- `src/app/(protected)/usage/page.tsx` — LLM usage dashboard
- `src/components/usage/*` — All usage dashboard components (BudgetAlert, BudgetSettings, ModelBreakdown, SpendingChart, TokenChart, UsageDashboard)

### 1.5 — Simplify LLM Infrastructure

The LLM router stays but gets simplified. One provider path: OpenRouter (OpenAI-compatible adapter).

**Keep:**
- `src/lib/llm/router.ts` — Simplified to route through OpenRouter only
- `src/lib/llm/adapters/openai-compatible.ts` — The one adapter we need
- `src/lib/llm/types.ts` — Shared types

**Delete:**
- `src/lib/llm/adapters/anthropic.ts` — Native Anthropic adapter (use OpenRouter instead)
- `src/lib/llm/adapters/google.ts` — Native Google adapter (use OpenRouter instead)
- `src/lib/models.ts` — User-facing model definitions (admin controls this)
- `src/lib/useModels.ts` — Client model hook (users don't pick models)
- `src/lib/cost.ts` — Per-message cost calculation (not relevant without chat)

**Simplify:**
- `src/lib/ai-models.ts` — Simplify to pull house model config from admin settings
- Router logic: always use OpenRouter, always use admin-configured model

### 1.6 — Remove Chat Dependencies

**npm packages to uninstall:**
- `@anthropic-ai/sdk` — Using OpenRouter instead
- `@google/generative-ai` — Using OpenRouter instead
- `highlight.js` — Chat code highlighting
- `react-markdown` — Chat message rendering
- `rehype-highlight` — Chat syntax highlighting
- `remark-gfm` — Chat markdown

**Keep:**
- `openai` — OpenRouter uses the OpenAI-compatible SDK

### 1.7 — Update Layout & Navigation

- **Sidebar** (`src/components/layout/Sidebar.tsx`): Remove chat conversation list, search, chat-related nav links, UsageBalance.
- **BottomNav** (`src/components/layout/BottomNav.tsx`): Remove chat/image/history nav items.
- **Middleware** (`src/middleware.ts`): Remove `/chat`, `/image`, `/history`, `/usage` from protected routes.
- **Root page** (`src/app/page.tsx`): Redirect to `/dashboard`.

### 1.8 — Remove Chat-Related Environment Variables

- `TAVILY_API_KEY` — Removed
- `TITLE_MODEL` — Removed (no conversation titles)
- `DEFAULT_CHAT_MODEL` — Removed (admin controls model)
- `DEFAULT_IMAGE_MODEL` — Removed
- `SIGNUP_SECRET` — Removed (open signup in Phase 3)

### 1.9 — Clean Up Tests & Documentation

- Delete `src/lib/__tests__/cost.test.ts`
- Delete `src/app/api/conversations/__tests__/route.test.ts`
- Update `src/types/database.ts` — Remove conversation/message/image types
- Delete old docs in `/docs/` (will be rewritten)
- Update `README.md`
- Update `CLAUDE.md`

---

## Phase 2: Database Schema (Fresh Design) ✅

Design the database from scratch. This is a new product — no migrations from the old schema.

**Completed 2026-03-22** — Fresh schema at `supabase/schema.sql`. Added api_keys, billing tables, source tracking on AI content. Renamed projects → spaces. Verified in Supabase.

### 2.1 — Core Tables

**Users & Auth** (managed by Supabase Auth + our profiles):
```sql
-- profiles: extends Supabase auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  plan TEXT NOT NULL DEFAULT 'free',       -- 'free' | 'active' | 'canceled' | 'expired'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,                -- 'active' | 'canceled' | 'past_due'
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Keys (for MCP connections):**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 — Productivity Tables

Carry forward the proven schema from the existing app:

- **tasks** — Franklin Covey A/B/C priorities, due dates, recurrence, rollover, space linking
- **habits** + **habit_logs** — Habit definitions with target days, daily completion logs
- **journal_entries** — Daily journal with mood tracking, full-text search
- **workout_templates** + **workout_exercises** — Reusable workout templates
- **workout_logs** + **workout_log_exercises** — Logged workouts with sets (JSONB)
- **focus_sessions** — Pomodoro timer sessions linked to tasks
- **goals** + **goal_progress_logs** — Goals with progress tracking, target dates, linked tasks/habits
- **weekly_reviews** — Weekly review summaries (generated by dashboard AI or Claude via MCP — last write wins)
- **spaces** — Group tasks, goals, and habits by area of life or initiative (replaces "projects", no file storage)
- **tags** — Tag system for tasks/spaces

### 2.3 — AI Feature Tables

- **daily_briefings** — Cached daily briefings (generated by dashboard AI or Claude via MCP — last write wins)
- **insight_cache** — Cached proactive insights (same last-write-wins pattern)
- **ai_model_config** — Per-task AI model configuration (admin-controlled)
- **ai_feature_toggles** — Feature toggle settings per user

### 2.4 — Admin & Config Tables

- **app_settings** — Key-value store for system config (house model API keys, encrypted)
- **usage_limits** — Per-user usage limits (AI suggestion requests per day, etc.)

### 2.5 — Billing Tables

```sql
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  action TEXT NOT NULL,                  -- 'created' | 'canceled' | 'renewed' | 'expired'
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.6 — RLS Policies

- Users can only read/write their own data (WHERE `user_id = auth.uid()`)
- API keys scoped to owner
- Admin flag on profiles for admin-only operations (app_settings, usage_limits)
- `stripe_events` server-side only (no client access)

### 2.7 — Indexes

- `api_keys(key_hash)` — Fast lookup during MCP auth
- `tasks(user_id, due_date)` — Task queries by date
- `habits(user_id)` + `habit_logs(habit_id, log_date)` — Habit completion lookups
- `journal_entries(user_id, entry_date)` — Journal by date
- `journal_entries` GIN index on content for full-text search
- `focus_sessions(user_id, started_at)` — Focus session queries
- `goals(user_id, status)` — Active goals
- `profiles(stripe_customer_id)` — Webhook lookups

### 2.8 — Schema File

Single consolidated schema file: `supabase/schema.sql`
- Run the entire file in Supabase SQL Editor to set up a new instance
- Contains all tables, indexes, RLS policies, triggers, and storage buckets
- No migration history — fresh start

---

## Phase 3: Multi-Tenant Auth & User Management ✅

Open signup, user self-service, onboarding.

**Completed 2026-03-22** — Open signup (secret code removed), Resend email infrastructure (5 templates), full settings page with 6 tabs (Account, API Keys, Connections, Subscription, Preferences, Danger Zone). Project→Space rename across entire codebase. Database types updated. 94 TS errors resolved.

### 3.1 — Open Signup

- Remove `SIGNUP_SECRET` requirement from `/api/auth/signup`
- Remove secret code field from `AuthForm.tsx`
- Add email verification requirement (Supabase Auth config)
- Add terms of service / privacy policy acceptance checkbox

### 3.2 — Transactional Emails (Resend)

Resend is already configured on the domain. Wire it into auth and account flows. Keep emails simple and professional.

- Install `resend` package
- Add `RESEND_API_KEY` env var
- Create `src/lib/email.ts` — Resend client + send helper
- Create email templates:
  - **Welcome** — sent after signup, brief intro + link to onboarding
  - **Email verification** — override Supabase default with branded Resend template
  - **Password reset** — override Supabase default with branded Resend template
  - **Account deleted** — confirmation after account deletion

### 3.3 — User Settings Page (New)

Replace the old settings page with a new account settings page:

- **Account section**: Email, password change, display name
- **API Keys section**: Generate, name, list, revoke API keys (see Phase 4)
- **MCP Connection section**: Instructions + connection string for Claude Code/Desktop/Cowork
- **Subscription section**: Subscription status, billing portal link, upgrade to paid
- **Preferences section**: Theme, timezone, notification preferences
- **Danger zone**: Delete account, export data

### 3.4 — Profile & Onboarding

- **Onboarding flow**: After signup (free plan), guide user through:
  1. Set display name and timezone
  2. Quick tour of dashboard tools
  3. Generate first API key
  4. Connect their first MCP client (with copy-paste instructions)
  5. Show upgrade prompt for paid plan (optional, can skip)
- **Data export**: User can export all their productivity data (JSON/CSV)

---

## Phase 4: API Key Management ✅

Users generate API keys from the dashboard to authenticate MCP connections.

**Completed 2026-03-22** — Key generation (da_sk_ + 36 bytes), SHA-256 hashing, validation middleware, CRUD API routes, settings UI fully wired. Free plan 1-key limit enforced.

### 4.1 — API Key Generation & Storage

- Key format: `da_sk_` prefix + 48 random chars (URL-safe base64)
- Store only the SHA-256 hash — never the raw key
- Return the full key exactly once at creation time
- RLS: Users can only manage their own keys

### 4.2 — API Key API Routes

- `POST /api/keys` — Generate new key (returns full key ONCE)
- `GET /api/keys` — List user's keys (prefix, name, created, last used — never full key)
- `DELETE /api/keys/[id]` — Revoke a key
- `PATCH /api/keys/[id]` — Update name, expiration

### 4.3 — API Key UI

- Settings page section with key list
- "Generate New Key" button → modal with name input
- Show full key once after creation with copy button + warning it won't be shown again
- Key list: name, prefix, created date, last used, revoke button
- Confirm dialog before revoking

### 4.4 — API Key Validation Middleware

- Utility function: extract key from `Authorization: Bearer da_sk_...` header
- Hash the key, look up in `api_keys` table
- Verify not revoked, not expired
- Check user's plan for MCP access level (free = read-only, paid = full)
- Update `last_used_at`
- Return user_id for downstream use

---

## Phase 5: Ory Hydra Integration (OAuth 2.1) ✅ (pending e2e test)

Set up Ory Hydra as the OAuth 2.1 authorization server for MCP spec compliance. This enables Claude Desktop, Claude Code, and Cowork to authenticate via the standard MCP OAuth flow.

**Completed 2026-03-23** — Hydra v2.3.0 deployed on Railway with Postgres. Login/consent UI, OAuth scopes, token validation, discovery endpoints, and Hydra admin client all implemented. DCR enabled. Admin API exposed via `hydra-admin.dailyagent.dev`. End-to-end OAuth flow testing blocked until Next.js app is deployed to Vercel (Hydra CSRF cookies require HTTPS + same production context).

### 5.1 — Hydra Infrastructure

- **Railway**: Deploy Hydra as Docker container + Railway-managed Postgres
- **Configuration**: Hydra config file with:
  - Issuer URL
  - CORS settings for Claude's callback URLs
  - Token lifetimes (short-lived access tokens, longer refresh tokens)
  - PKCE enforcement
  - Supported grant types: `authorization_code`, `refresh_token`
- **Secrets management**: Hydra system secret, cookie secrets

### 5.2 — Login & Consent UI

Hydra is headless — it delegates login and consent to our app. We need two endpoints:

**Login endpoint** (`/oauth/login`):
- Hydra redirects here when a user needs to authenticate
- We show our existing Supabase login form
- On successful login, we tell Hydra who the user is
- Handles: accept/reject login challenge via Hydra Admin API

**Consent endpoint** (`/oauth/consent`):
- Hydra redirects here after login
- We show which scopes the MCP client is requesting
- User approves or denies
- Handles: accept/reject consent challenge via Hydra Admin API
- Scope display: human-readable labels for each scope ("Read your tasks", "Manage your habits", etc.)

### 5.3 — OAuth Discovery Endpoints

Required by MCP spec — Hydra provides most of these automatically:

- `/.well-known/oauth-authorization-server` — Authorization Server Metadata (Hydra serves this)
- `/.well-known/oauth-protected-resource` — Protected Resource Metadata (we serve this, pointing to Hydra)
- `/.well-known/openid-configuration` — OIDC Discovery (Hydra serves this)

**We need to implement:**
- Protected Resource Metadata endpoint on our MCP server that advertises Hydra as the authorization server
- `WWW-Authenticate` header on 401 responses from MCP endpoints

### 5.4 — Dynamic Client Registration

- Hydra supports DCR (RFC 7591) — enable it in config
- Claude Code/Desktop will register as OAuth clients automatically
- Claude's callback URL: `https://claude.ai/api/mcp/auth_callback`
- Client ID Metadata Document support (preferred by MCP spec)

### 5.5 — Token Validation

- MCP server validates access tokens issued by Hydra
- Token introspection via Hydra Admin API, or JWT validation if using JWT access tokens
- Validate audience (resource parameter) matches our MCP server URL
- Map token subject to Supabase user_id for data access
- Reject tokens not issued for our server

### 5.6 — Scopes Definition

Define granular scopes for MCP access:

| Scope | Description |
|-------|-------------|
| `tasks:read` | Read tasks |
| `tasks:write` | Create, update, delete tasks |
| `habits:read` | Read habits and logs |
| `habits:write` | Manage habits, toggle logs |
| `journal:read` | Read journal entries |
| `journal:write` | Create, update journal entries |
| `workouts:read` | Read workout templates and logs |
| `workouts:write` | Create, update workouts |
| `focus:read` | Read focus sessions |
| `focus:write` | Start, complete focus sessions |
| `goals:read` | Read goals and progress |
| `goals:write` | Manage goals and progress |
| `calendar:read` | Read calendar data |
| `spaces:read` | Read spaces |
| `spaces:write` | Manage spaces |
| `profile:read` | Read user profile |
| `profile:write` | Update user profile |
| `briefing:read` | Read daily briefings |
| `briefing:write` | Generate/overwrite daily briefings |
| `review:read` | Read weekly reviews |
| `review:write` | Generate/overwrite weekly reviews |
| `all` | All permissions (convenience scope) |

### 5.7 — User Identity Bridging

**Approach — Hydra delegates to Supabase Auth:**
- Login UI authenticates via Supabase
- On success, passes Supabase user ID to Hydra as the subject
- Hydra tokens carry the Supabase user_id as the subject claim
- MCP server extracts user_id from token, queries Supabase directly

Hydra is purely the OAuth token issuer; Supabase remains the source of truth for identity.

---

## Phase 6: MCP Server Implementation

Build the MCP server that exposes productivity data as tools and resources. Same data layer the dashboard uses — two interfaces, one source of truth.

### 6.1 — MCP Server Framework

- **Transport**: Streamable HTTP (required for remote servers)
- **SDK**: `@modelcontextprotocol/sdk` (official TypeScript SDK)
- **Endpoint**: `/api/mcp` — single endpoint for all MCP communication
- **Auth**: Validate OAuth access token (Hydra) or API key on every request
- **Session**: Stateless — each request authenticated independently
- **Plan enforcement**: Free users get read-only tools; paid users get full access

The MCP server and the dashboard share the same Supabase data layer. Changes made via MCP appear in the dashboard and vice versa. AI-generated content (briefings, reviews) follows a last-write-wins pattern — whichever interface generated it most recently is what the user sees.

### 6.2 — MCP Resources (Read-Only Data)

Resources are things the AI can read/reference:

| Resource URI | Description |
|---|---|
| `dailyagent://tasks/today` | Today's tasks with priorities |
| `dailyagent://tasks/overdue` | Overdue tasks |
| `dailyagent://habits/today` | Today's habit status |
| `dailyagent://habits/streaks` | Current habit streaks |
| `dailyagent://journal/today` | Today's journal entry |
| `dailyagent://journal/recent` | Last 7 journal entries |
| `dailyagent://workouts/recent` | Recent workout logs |
| `dailyagent://focus/today` | Today's focus sessions |
| `dailyagent://goals/active` | Active goals with progress |
| `dailyagent://calendar/{date}` | Day detail for a specific date |
| `dailyagent://calendar/week` | Current week overview |
| `dailyagent://dashboard` | Aggregated daily snapshot |
| `dailyagent://spaces` | Active spaces list |
| `dailyagent://review/latest` | Latest weekly review |
| `dailyagent://briefing/today` | Today's daily briefing |

### 6.3 — MCP Tools (Actions)

Tools are things the AI can do. Read tools available on free plan, write tools require paid plan.

**Tasks:**
- `create_task` — Create a new task (title, priority, due_date, space_id) *(paid)*
- `update_task` — Update task fields *(paid)*
- `complete_task` — Mark task complete *(paid)*
- `delete_task` — Delete a task *(paid)*
- `list_tasks` — List tasks with filters (date, priority, space, status) *(free)*
- `rollover_tasks` — Roll over incomplete tasks to today *(paid)*
- `reorder_tasks` — Reorder tasks by priority *(paid)*

**Habits:**
- `create_habit` — Create a new habit *(paid)*
- `update_habit` — Update habit fields *(paid)*
- `toggle_habit` — Toggle habit completion for a date *(paid)*
- `list_habits` — List habits with streaks/stats *(free)*
- `get_habit_stats` — Get detailed habit statistics *(free)*

**Journal:**
- `create_journal_entry` — Create/update journal entry for a date *(paid)*
- `get_journal_entry` — Get entry for a specific date *(free)*
- `search_journal` — Full-text search across journal entries *(free)*
- `list_journal_entries` — List entries with date range *(free)*

**Workouts:**
- `create_workout_template` — Create a workout template *(paid)*
- `log_workout` — Log a completed workout *(paid)*
- `list_workout_logs` — List workout history *(free)*
- `get_workout_stats` — Get workout statistics *(free)*

**Focus:**
- `start_focus_session` — Start a pomodoro session *(paid)*
- `complete_focus_session` — End a focus session *(paid)*
- `get_focus_stats` — Get focus statistics *(free)*

**Goals:**
- `create_goal` — Create a new goal *(paid)*
- `update_goal` — Update goal fields *(paid)*
- `log_goal_progress` — Log progress toward a goal *(paid)*
- `list_goals` — List goals with progress *(free)*

**Spaces:**
- `create_space` — Create a space *(paid)*
- `update_space` — Update space details *(paid)*
- `list_spaces` — List spaces *(free)*

**Calendar & Review:**
- `get_day_summary` — Get summary for a specific date *(free)*
- `get_week_summary` — Get weekly summary *(free)*
- `generate_weekly_review` — Generate and save a weekly review (overwrites dashboard version) *(paid)*

**Briefings & Insights:**
- `get_daily_briefing` — Get today's briefing *(free)*
- `generate_daily_briefing` — Generate and save a daily briefing (overwrites dashboard version) *(paid)*
- `get_insights` — Get cached insights *(free)*

### 6.4 — MCP Prompts (Templates)

Pre-built prompt templates — paid plan only. These are the core intelligence layer that makes the $20/mo worth it. They guide the AI to reason across all your data.

**Daily workflow prompts:**

| Prompt | Description |
|--------|-------------|
| `daily_planning` | Plan the day: review tasks by priority, check habits due, surface overdue items, suggest focus areas |
| `morning_briefing` | Quick snapshot: what's on today, streaks at risk, upcoming deadlines, yesterday's incomplete tasks |
| `end_of_day_review` | Wrap up: what got done, what didn't, reschedule or rollover remaining tasks |

**Analysis & insight prompts:**

| Prompt | Description |
|--------|-------------|
| `productivity_report` | Generate a productivity report for a date range across all tools |
| `habit_analysis` | Analyze habit completion patterns, streak health, suggest improvements |
| `goal_check_in` | Review progress on active goals, flag at-risk goals, suggest next actions |
| `weekly_trends` | Compare this week vs last: task completion rate, habit consistency, workout frequency |

**Content generation prompts:**

| Prompt | Description |
|--------|-------------|
| `weekly_review` | Guide the user through a structured weekly review and save it |
| `journal_prompt` | Generate a thoughtful journal prompt based on recent activity and mood patterns |
| `workout_suggestion` | Suggest a workout based on history, templates, and recent activity |

**Planning prompts:**

| Prompt | Description |
|--------|-------------|
| `goal_planning` | Break down a goal into tasks, set milestones, link habits |
| `space_planning` | Plan a space: create tasks, set priorities, estimate timeline |
| `week_planning` | Plan the week ahead: distribute tasks, schedule habits, set focus areas |

### 6.5 — Auth Middleware for MCP

The MCP endpoint needs to accept both auth methods:

1. **OAuth access token** (from Hydra) — for Claude Desktop/Code/Cowork
   - Extract from `Authorization: Bearer <token>`
   - Validate via Hydra token introspection
   - Extract user_id from token subject
   - Validate scopes against requested operation

2. **API key** (from Phase 4) — for programmatic/third-party access
   - Extract from `Authorization: Bearer da_sk_...`
   - Hash and look up in `api_keys` table
   - Extract user_id from key record

Logic: Try API key first (check prefix), fall back to OAuth token validation.

### 6.6 — Rate Limiting for MCP

- Per-user rate limits on MCP requests
- Free: 500 requests/day
- Paid: 10,000 requests/day
- Return `429 Too Many Requests` with `Retry-After` header
- Per-user overrides configurable via Supabase if needed

---

## Phase 7: Stripe Integration & Pricing

### 7.1 — Pricing Structure

**Free Plan — $0/month:**
- Full dashboard access (all productivity tools, focus timer)
- AI suggestions in dashboard (briefing, insights, review, journal prompts) powered by house model with usage limits
- Read-only MCP access (list, get, view tools + all resources)
- 1 API key
- 500 MCP requests/day

**Paid Plan — $10/month ($8/month billed annually):**
- Everything in Free
- Full MCP write access (create, update, delete, rollover, reorder)
- All MCP prompt templates (daily planning, weekly review, habit analysis, etc.)
- Claude/MCP can overwrite dashboard-generated briefings and reviews
- Unlimited API keys
- 10,000 MCP requests/day
- Data export (JSON/CSV)
**Annual plan: $96/year ($8/month):**
- 2 months free vs monthly

**Why this works:**
- Free dashboard competes with Todoist/Habitica on its own — drives signups and data building
- AI suggestions work on free tier via house model (capped usage, cheap to run)
- Read-only MCP is the hook: "show me my tasks" works, "create a task" is the upgrade moment
- $20/mo justified: Claude managing your entire life across all tools via prompt templates
- Prompt templates are the premium — cross-tool intelligence no one else has
- Zero AI inference cost for MCP (user's Claude handles it). House model cost controlled via usage limits and cheap OpenRouter models.

### 7.2 — Stripe Setup

- Create Stripe account and products/prices
- **Product**: Daily Agent Pro
- **Prices**: $20/month (monthly) + $192/year (annual)
- Store `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as env vars
- Store `STRIPE_WEBHOOK_SECRET` for webhook verification
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for client-side Checkout

### 7.3 — Checkout Flow

- **Upgrade flow**: Free user → Stripe Checkout Session
- `POST /api/stripe/checkout` — Create Checkout Session
  - Pass user_id as `client_reference_id`
  - Set success/cancel URLs
  - Offer monthly ($20) and annual ($192) options
- Stripe hosted checkout page (no custom payment form needed)
- On success, redirect back to dashboard with success message
- **Resubscribe flow**: Expired user → same Checkout Session flow

### 7.4 — Stripe Webhooks

- `POST /api/stripe/webhook` — Receive Stripe events
- Verify webhook signature with `STRIPE_WEBHOOK_SECRET`
- Idempotent processing via `stripe_events` table
- Handle events:
  - `checkout.session.completed` → Set user plan to 'active', store subscription ID
  - `customer.subscription.updated` → Update subscription status
  - `customer.subscription.deleted` → Downgrade to free plan
  - `invoice.payment_succeeded` → Log renewal
  - `invoice.payment_failed` → Mark subscription as past_due

### 7.5 — Billing Emails (Resend)

Triggered by Stripe webhook events. Simple, professional, text-focused.

- **Subscription activated** — sent after successful payment, welcome to paid plan
- **Payment successful** — receipt confirmation (or let Stripe handle receipts)
- **Payment failed** — alert with link to update payment method
- **Subscription canceled** — confirmation, mention data is retained on free plan, resubscribe link

### 7.6 — Billing Portal

- `POST /api/stripe/portal` — Create Stripe Billing Portal session
- Link from settings page → user can manage payment method, cancel, view invoices
- Stripe hosts the portal UI — no custom billing pages needed

### 7.7 — Plan Enforcement

- **MCP write tools**: Require paid plan (active) — free users get read-only
- **MCP prompt templates**: Paid only
- **MCP read tools/resources**: Available to all users (free + paid)
- **Dashboard AI suggestions**: Available to all users, usage-capped via existing limits system
- **MCP briefing/review overwrite**: Paid only (Claude can overwrite dashboard-generated content)
- **API key limits**: Free = 1 key, paid = unlimited
- **Rate limits**: Free = 500 MCP requests/day, paid = 10,000/day
- **Dashboard**: Always accessible regardless of plan
- **Middleware**: Plan check happens after auth, before tool execution
- **Grace period**: If paid subscription lapses, 3-day grace before downgrading to free

---

## Phase 8: Marketing Site

Port the existing marketing site from the separate repo (`/Users/adamwickwire/GitHub/daily-agent`, live at `dailyagent.dev`) into this repo as public routes. One repo, one deploy.

**Existing infrastructure to port:**
- Hero, stats bar, features grid, all section components
- Docs section with sidebar layout (setup, admin, user, customization)
- SEO infrastructure (sitemap.ts, robots.ts, OG image generation, JSON-LD)
- Legal pages (terms, privacy)
- Header component (for public pages)
- Screenshots from `/public`

**Route structure after merge:**
```
src/app/
  page.tsx              — Landing page (marketing, public)
  pricing/page.tsx      — Pricing page (public)
  docs/                 — Documentation with sidebar layout (public)
  terms/page.tsx        — Terms of service (public)
  privacy/page.tsx      — Privacy policy (public)
  (auth)/               — Login, signup (public, redirects if authed)
  (protected)/          — Dashboard, tasks, habits, etc. (requires auth)
```

Middleware already skips auth for public routes. Marketing pages are server components — no client JS needed.

**Color system:** Merge the daily-agent color tokens into the existing `globals.css` or adapt the marketing pages to use the existing theme. One design system across marketing + app.

### 8.1 — Reposition Copy

Update all marketing copy from "buy this template" to "sign up for this SaaS":

- **Hero**: New headline focused on AI productivity + MCP. CTA → "Sign Up Free"
- **Subtitle**: Rewrite from self-hosted pitch to SaaS value prop
- **Stats bar**: Update metrics (e.g., "30+ MCP Tools", "Works with Claude & ChatGPT", etc.)
- **Features grid**: Keep productivity tool features, add MCP integration section, remove template-sale language
- **JSON-LD**: Update from one-time $50 purchase to SaaS subscription model
- **CTA buttons**: "Coming Soon" → "Sign Up Free" / "Go Pro" (link to app signup)

### 8.2 — Add Pricing Section/Page

- Add pricing section to homepage
- Create `/pricing` page with free vs paid comparison
- Feature checklist for each plan
- FAQ section (billing, cancellation, what's included)
- CTAs link to app signup page

### 8.3 — Add MCP Section

New section on homepage explaining:
- What MCP is and why it matters
- Which AI clients are supported (Claude Code, Claude Desktop, Cowork, ChatGPT)
- How it works: 3-step flow (Sign up → Use the dashboard → Connect your AI)
- Visual showing dashboard + Claude side by side

### 8.4 — Update Documentation

Existing docs section has setup, admin, user, and customization guides. Rewrite for SaaS:

- **Getting Started**: Sign up → explore dashboard → generate API key → connect AI client
- **MCP Connection Guides**: Step-by-step for Claude Code, Claude Desktop, Cowork
- **Tool Reference**: All MCP tools with parameters and examples
- **Resource Reference**: Available MCP resources and their data format
- **Dashboard Guide**: How to use each productivity tool via the web UI
- **FAQ / Troubleshooting**

### 8.5 — Update Legal Pages

- Update Terms of Service for SaaS model (subscriptions, data handling, cancellation)
- Update Privacy Policy
- Both pages already exist — just need content updates

### 8.6 — Update SEO

- Update meta descriptions for new positioning
- Update OG image text
- Update sitemap with new pages (/pricing, updated docs)
- Target keywords: MCP server, AI productivity, Claude tools, daily agent

---

## Phase 9: Dashboard Review & Improvement

The dashboard is a real product surface — free users live here. It needs to be genuinely good as a standalone productivity tool.

### 9.1 — Dashboard UX Review

The existing dashboard was built as a secondary feature behind the chat interface. Now it's the front door. Review and improve:

- **Visual audit**: Does it look and feel like a product worth paying for? Clean, modern, polished.
- **Mobile experience**: PWA needs to feel native. Review touch targets, spacing, bottom nav.
- **Performance**: Page load times, skeleton states, optimistic updates.
- **Empty states**: New users see empty tools — these need to guide, not just say "nothing here."
- **Data entry UX**: Adding tasks, logging habits, writing journal entries needs to be fast and frictionless.

### 9.2 — Tool-by-Tool Review

Each productivity tool gets a review pass:

- **Tasks**: Does the Franklin Covey priority system make sense for a general audience? Is task creation fast enough? Mobile UX?
- **Habits**: Is the tracker clear? Do streaks motivate? Is toggling completion quick?
- **Journal**: Is the editor good enough for daily writing? Mood tracking useful?
- **Workouts**: Templates and logging — is this too complex or just right?
- **Focus**: Timer UX, session linking to tasks, stats display.
- **Goals**: Progress tracking clear? Linking to tasks/habits intuitive?
- **Spaces**: How do users organize their data? Is the concept clear?
- **Calendar**: Does the aggregated view add value?
- **Weekly Review**: Manual review creation UX, display of AI-generated reviews.

### 9.3 — Navigation Restructure

**Sidebar updates:**
- Remove: Chat conversation list, search, chat nav links, UsageBalance
- Keep: Dashboard, Tasks, Habits, Journal, Workouts, Focus, Goals, Calendar, Review, Spaces
- Add: Settings (account + API keys)
- Add: "Connect AI" quick-action — shows MCP connection instructions
- Add: Plan badge (Free / Pro) with upgrade CTA

**Bottom nav updates (mobile):**
- Remove: Chat, Image, History
- Keep: Dashboard, Tasks, Habits, More (menu for remaining tools)

### 9.4 — Settings Page (Account & API Keys)

New settings page replacing the old chat-focused one:

- **Account tab**: Email, display name, password change, avatar
- **API Keys tab**: Key management UI (generate, list, revoke)
- **Connections tab**: MCP connection instructions per client
  - Claude Code: config snippet for `settings.json`
  - Claude Desktop: instructions for adding via Settings > Connectors
  - Cowork: connection setup
  - Generic: API endpoint URL + auth instructions
- **Subscription tab**: Subscription status, billing portal link, upgrade to paid
- **Preferences tab**: Theme, timezone, date format
- **Data tab**: Export all data, delete account

### 9.5 — Dashboard Home Enhancements

- **Getting started card**: For new users — guide to first task, first habit, first MCP connection
- **Connection status widget**: Show active MCP connections (based on API key last_used_at)
- **Upgrade prompt**: For free users — show what they're missing (write access, prompts, analysis)
- **Data summary widgets**: Task, Habit, Journal, Workout, Focus, Goal counts and recent activity
- **AI suggestion widgets**: Daily briefing, insight cards (powered by house model)

---

## Phase 10: Infrastructure & Deployment

### 10.1 — Deployment Architecture

**Next.js app → Vercel (free tier)**
- Auto-deploy from GitHub
- CDN, auto-scaling, zero ops
- Handles dashboard, API routes, and MCP endpoint

**Ory Hydra + Postgres → Railway ($5/mo)**
- Hydra runs as a Docker container on Railway
- Railway-managed Postgres instance for Hydra's data
- Auto-deploy from Docker image
- Low traffic — only handles OAuth flows on initial MCP client connection + token refreshes

**Supabase → hosted (free tier)**
- Auth, database, storage
- All productivity data lives here

**Stripe → their infrastructure**
- No hosting needed — webhook endpoint lives in our Vercel app

**Total infrastructure cost: $5/mo + OpenRouter usage for house model**

### 10.2 — Environment Configuration

**New environment variables:**
- `HYDRA_PUBLIC_URL` — Hydra public endpoint
- `HYDRA_ADMIN_URL` — Hydra admin endpoint (internal)
- `MCP_SERVER_URL` — Public URL of the MCP endpoint
- `HYDRA_SYSTEM_SECRET` — Hydra encryption secret
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `RESEND_API_KEY` — Resend API key for transactional emails

**Keep:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ENCRYPTION_KEY` — For API key encryption at rest
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_SITE_DESCRIPTION`

### 10.3 — Railway Setup (Hydra)

- Create Railway project with two services:
  - **Hydra**: Deploy from `oryd/hydra` Docker image
  - **Postgres**: Railway-managed Postgres instance
- Configure Hydra environment variables (DSN, secrets, URLs)
- Set up custom domain: `auth.dailyagent.com` → Railway service
- Railway handles TLS automatically
- Health checks on Hydra's `/health/ready` endpoint

### 10.4 — Domain & TLS

- Main app: `dailyagent.com` (marketing + app on same domain)
- OAuth/Hydra: `auth.dailyagent.com`
- MCP endpoint: `dailyagent.com/api/mcp`
- All HTTPS (required by OAuth 2.1 spec)

### 10.5 — CI/CD Updates

- Vercel: auto-deploys from GitHub on push to main (built-in)
- Railway: auto-deploys Hydra on config changes
- GitHub Actions: run tests on PR
- Health check smoke tests post-deploy
- Environment-specific configs (dev, staging, prod)

---

## Phase 11: Testing & Quality

### 11.1 — MCP Server Tests

- **Tool tests**: Each MCP tool returns correct data, handles errors
- **Resource tests**: Each resource returns correctly formatted data
- **Auth tests**: OAuth token validation, API key validation, rejection of invalid credentials
- **Scope tests**: Operations rejected when token lacks required scope
- **Plan enforcement tests**: Free users limited to read-only MCP, paid users get write + prompts
- **Rate limit tests**: Requests throttled correctly
- **Overwrite tests**: MCP-generated briefings/reviews correctly overwrite dashboard versions

### 11.2 — OAuth Flow Tests

- **End-to-end**: Full OAuth authorization code flow with PKCE
- **Login challenge**: Hydra → login UI → accept → redirect
- **Consent challenge**: Consent UI → accept/deny → token issued
- **Token refresh**: Refresh token flow works correctly
- **Token revocation**: Revoked tokens are rejected
- **DCR**: Dynamic client registration works for new clients

### 11.3 — API Key Tests

- Generate key, validate it works
- Revoke key, confirm rejected
- Expired key rejected
- Invalid key format rejected
- Last used timestamp updated on use
- Free user limited to 1 key, paid gets unlimited

### 11.4 — Stripe Tests

- Checkout session creation
- Webhook signature validation
- Idempotent event processing
- Grace period behavior on failed payment
- Billing portal session creation

### 11.5 — Integration Tests

- MCP client → OAuth flow → MCP tool call → Supabase data → response
- API key → MCP tool call → Supabase data → response
- Multiple users can't access each other's data
- Rate limiting works across auth methods
- Free user → paid upgrade flow
- Paid user cancel → grace period → downgrade to free
- Dashboard AI generates briefing → Claude overwrites via MCP → dashboard shows MCP version

### 11.6 — Existing Test Updates

- Update existing productivity API tests for new schema
- Add new test utilities for MCP, OAuth, and Stripe mocking

---

## Phase 12: Documentation & Launch

### 12.1 — User Documentation

- **Getting Started Guide**: Sign up → explore dashboard → generate API key → connect Claude/Desktop
- **MCP Connection Guide**: Step-by-step for each supported client
- **Tool Reference**: What each MCP tool does, parameters, examples
- **Resource Reference**: Available resources and their data format
- **Dashboard Guide**: How to use each productivity tool via the web UI
- **FAQ**: Common issues, troubleshooting

### 12.2 — Developer Documentation

- **API Reference**: All API endpoints (REST + MCP)
- **OAuth Flow**: How authentication works, scopes, token lifecycle
- **Self-Hosting Guide**: Docker Compose setup, Hydra config, Supabase setup
- **Architecture Overview**: System diagram, data flow, component responsibilities

### 12.3 — Deployment Documentation

- **Production Checklist**: Security, performance, monitoring
- **Environment Variables Reference**: All env vars with descriptions
- **Hydra Configuration Guide**: Setting up and managing Ory Hydra
- **Backup & Recovery**: Database backup strategy, disaster recovery

### 12.4 — Analytics (Vercel Analytics)

The daily-agent marketing site already uses `@vercel/analytics`. Bring it into this repo and set up custom events for the metrics that matter.

**Setup:**
- Install `@vercel/analytics` (already in daily-agent repo)
- Add `<Analytics />` component to root layout
- Enable Vercel Analytics in project settings

**Custom events to track:**

| Event | Trigger | Why |
|-------|---------|-----|
| `signup` | User completes registration | Top of funnel |
| `onboarding_complete` | User finishes onboarding flow | Activation |
| `api_key_created` | User generates first API key | MCP intent |
| `mcp_first_connection` | First MCP request from a user | Activation (MCP) |
| `upgrade_started` | Free user clicks upgrade / enters checkout | Conversion intent |
| `subscription_activated` | Payment successful, plan set to active | Revenue |
| `subscription_canceled` | User cancels subscription | Churn |
| `upgrade_cta_clicked` | Free user clicks upgrade prompt in dashboard | Conversion funnel |
| `dashboard_tool_used` | User interacts with a productivity tool | Engagement |
| `ai_suggestion_viewed` | User views briefing/insight/review | AI feature usage |

**Vercel Web Analytics** (page views, referrers, devices) comes free. **Custom events** require the Vercel Analytics paid plan or the free tier quota.

### 12.5 — Launch Checklist

- **MCP Server Registry**: Submit to Anthropic's MCP server registry for discoverability
- **README**: Updated for new product direction
- **Stripe**: Live mode enabled, pricing finalized
- **Monitoring**: Error tracking (Sentry or similar), uptime monitoring
- **Analytics**: Vercel Analytics enabled, custom events firing

---

## Phase 13: Future (Post-Launch)

Potential future phases based on demand:

- **Team/Organization Support** — Shared spaces, team dashboards, role-based access
- **Webhooks** — Notify external systems on task completion, habit streaks, etc.
- **Integrations** — Google Calendar sync, Todoist import, Apple Health, etc.
- **Data Import** — Import from Todoist, Habitica, etc. (lower switching cost)
- **Mobile App** — React Native wrapper for app store distribution
- **Custom MCP Tools** — Let users define custom tools/resources via the dashboard
- **Self-hosted AI Model** — Run your own model for AI suggestions (reduce OpenRouter dependency)
- **Analytics Dashboard** — User activity analytics, productivity trends
- **Notifications** — Push notifications for task reminders, habit streaks at risk, goal deadlines
- **Enterprise Plan** — SSO (SAML), audit logs, SLAs, custom domains
- **Admin Dashboard** — Custom admin panel (currently using Supabase + Stripe dashboards directly)

---

## Execution Order & Dependencies

```
Phase 1  (Codebase Cleanup)     — No dependencies, do first
    ↓
Phase 2  (Database Schema)      — Depends on 1 (clean slate)
    ↓
Phase 3  (Multi-Tenant Auth)    — Depends on 2 (schema ready)
    ↓
Phase 4  (API Keys)             — Depends on 2 + 3
    ↓
Phase 5  (Ory Hydra)            — Depends on 3 (auth infrastructure)
    ↓
Phase 6  (MCP Server)           — Depends on 4 + 5 (auth ready)
    ↓
Phase 7  (Stripe & Pricing)     — Depends on 2 + 3 (user model)
    ↓
Phase 8  (Marketing Site)       — Can start during 6-7, finish before launch
    ↓
Phase 9  (Dashboard Review)     — Can start during 4, finish after 7
    ↓
Phase 10 (Infrastructure)       — Starts with 5 (Railway), finishes after 8
    ↓
Phase 11 (Testing)              — Ongoing, ramps up after 6
    ↓
Phase 12 (Documentation)        — After 6-11 stabilize
```

Phases 4 and 5 can be developed in parallel.
Phase 7 can start as soon as the user model exists (Phase 3).
Phase 8 can be built in parallel with 6-7.
Phase 9 overlaps with 4-7 as features land.
Phase 10 infrastructure work starts early (Railway for Hydra) and continues throughout.
