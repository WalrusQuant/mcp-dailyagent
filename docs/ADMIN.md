# Admin Guide

Everything an admin needs to configure and manage the app. Admin access is required for provider management, model configuration, usage limits, and user oversight.

---

## Becoming an Admin

Admin status is set directly in the database. After signing up:

```sql
UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
```

Refresh the app. The Settings page now shows admin-only sections: Provider Management, Model Management, Usage Limits, and Usage Overview.

Admin accounts bypass all rate limits and usage limits.

---

## Provider Management

Manage API keys for AI providers. Located in **Settings → Provider Management**.

### Supported providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | Claude family | Native SDK adapter. Best for tool calling. |
| **Google** | Gemini family | Native Google AI SDK. Cheapest flash models. |
| **OpenAI** | GPT family | OpenAI-compatible adapter. |
| **OpenRouter** | Any model | Proxy that routes to 100+ models. Single API key for everything. |

### Adding a provider

1. Click **Add Provider** (or the edit icon next to an existing provider)
2. Enter the API key
3. Click **Save**
4. Use the **Test** button to verify the key works

### Security

- API keys are encrypted with **AES-256-GCM** before being stored in the database
- Keys are never sent back to the client — the API returns masked values (`••••xxxx`)
- The `ENCRYPTION_KEY` environment variable is required for encryption/decryption
- If you rotate the `ENCRYPTION_KEY`, you must re-enter all provider API keys

### Custom OpenAI-compatible endpoints

The OpenAI-compatible adapter supports any endpoint that follows the OpenAI API spec. This includes:

- OpenRouter (`https://openrouter.ai/api/v1`)
- xAI (Grok)
- Local models via Ollama, LM Studio, etc.
- Any OpenAI-compatible proxy

The base URL is configurable per provider in the admin settings.

---

## Model Management

Define which models are available to users. Located in **Settings → Model Management**.

### Adding a model

Click **Add Model** and fill in:

| Field | Description | Example |
|-------|-------------|---------|
| **Model ID** | The provider's identifier for this model | `claude-sonnet-4-5-20250514` |
| **Display Name** | What users see in the model selector | `Claude Sonnet 4.5` |
| **Provider** | Which configured provider serves this model | `anthropic` |
| **Type** | `chat` or `image` | `chat` |
| **Input Price** | Cost per million input tokens (for usage tracking) | `3.00` |
| **Output Price** | Cost per million output tokens | `15.00` |
| **Default** | Whether this is the default model for new conversations | Toggle on/off |
| **Sort Order** | Display order in the model selector (lower = higher) | `1` |

### Model routing

The app routes each model to the correct provider adapter automatically based on the provider field:

- Models with provider `anthropic` → Anthropic SDK adapter
- Models with provider `google` → Google AI SDK adapter
- Models with provider `openai`, `openrouter`, `xai`, or any custom → OpenAI-compatible adapter

### Special-purpose models

Some features use dedicated models configured separately:

| Purpose | Configuration | Default |
|---------|--------------|---------|
| **Conversation titles** | `TITLE_MODEL` env var or admin setting | `google/gemini-3-flash-preview` |
| **Default chat model** | `DEFAULT_CHAT_MODEL` env var or admin setting | `anthropic/claude-sonnet-4.5` |
| **Image generation** | `DEFAULT_IMAGE_MODEL` env var or admin setting | `google/gemini-2.5-flash-image` |
| **Web search summarization** | Per-user setting in their profile | Title model |
| **Briefing / Insights / Tools** | Per-user `ai_model_config` or title model | Title model |
| **AI Assist** | Per-user `ai_model_config` or default chat model | Default chat model |

Users can override briefing, insights, assist, and tools models from their Settings page under "AI Model Config".

---

## Usage Limits

Control how much each user can spend. Located in **Settings → Usage Limits**.

### Setting limits

| Setting | Description |
|---------|-------------|
| **Monthly Budget** | Maximum dollar amount a user can spend per calendar month. When reached, AI requests are blocked. |
| **Daily Conversation Limit** | Maximum number of new conversations a user can create per day. |
| **Warning Threshold** | Percentage of budget at which the user sees a warning banner (default: 80%). |

### How limits are enforced

- **Budget check**: Before every AI request (chat, image, briefing, insights, assist), the server sums the user's `total_cost` across all messages for the current calendar month. If it exceeds their budget, the request is rejected with a clear error message.
- **Conversation limit**: Before creating a new conversation, the server counts conversations created today. If at the limit, creation is blocked.
- **Admin bypass**: Admin accounts (`is_admin = true`) bypass all limits.

### Per-user vs global defaults

- Set a **global default** budget that applies to all users without custom limits
- Override with **per-user limits** for specific users who need more or less capacity
- Users can see their own usage and budget status on the Usage dashboard

---

## Rate Limiting

The app enforces per-user, per-category rate limits using an in-memory sliding window. These protect against runaway costs and abuse.

### Default rate limits

| Category | Window | Limit |
|----------|--------|-------|
| **chat** | 1 minute | 20 requests |
| **image** | 1 minute | 5 requests |
| **search** | 1 minute | 10 requests |
| **ai-assist** | 1 minute | 15 requests |

When a limit is hit, the API returns HTTP 429 with a `Retry-After` header.

### Limitations

Rate limits use in-memory storage. On serverless platforms (Vercel), limits reset on cold starts. This means limits are best-effort rather than exact — they prevent sustained abuse but may not catch burst patterns across function restarts.

---

## Usage Overview

Aggregate usage statistics across all users. Located in **Settings → Usage Overview**.

### What you can see

- **Total spend** across all users for the current month
- **Per-user breakdown**: messages sent, tokens consumed, total cost
- **Model usage**: which models are being used most, cost per model
- **Spending trends**: daily/weekly charts

### User-level detail

Click any user in the overview to see:
- Their conversation count
- Token usage by model
- Monthly cost trend
- Current budget utilization

---

## User Management

There's no dedicated user management UI — user accounts are managed through Supabase.

### Common operations

**View all users:**
```sql
SELECT email, is_admin, monthly_budget, created_at FROM profiles ORDER BY created_at;
```

**Grant admin access:**
```sql
UPDATE profiles SET is_admin = true WHERE email = 'user@example.com';
```

**Revoke admin access:**
```sql
UPDATE profiles SET is_admin = false WHERE email = 'user@example.com';
```

**Set a user's budget:**
```sql
UPDATE profiles SET monthly_budget = 25.00 WHERE email = 'user@example.com';
```

**Delete a user:**
Delete from Supabase Authentication dashboard (Authentication → Users). The `ON DELETE CASCADE` triggers will clean up all their data (conversations, messages, tasks, habits, etc.).

### Controlling access

- **Signup secret**: Only people with the `SIGNUP_SECRET` can create accounts. Change it anytime to prevent new signups without affecting existing users.
- **Disable signups**: Remove or unset the `SIGNUP_SECRET` environment variable. The signup endpoint returns "Signup is disabled."
- **OAuth**: If you enable OAuth providers in Supabase, users can sign in without the secret code. Supabase creates the auth user directly. A profile row is auto-created via the database trigger.

---

## App Configuration

Configuration follows a priority chain: **Admin Settings (DB) → Environment Variables → Hardcoded Defaults**.

Settings configured from the admin panel are stored in the database and take priority over environment variables. This means after initial deployment with 2-3 env vars, everything else can be managed from the UI.

### Configuration cache

Database-backed settings are cached in memory for 5 minutes to avoid repeated queries. Changes made in the admin panel take effect within 5 minutes, or immediately on the next cold start.

### Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for encrypting API keys |
| `SIGNUP_SECRET` | Yes | Secret code for account creation |
| `TAVILY_API_KEY` | No | Tavily web search API key |
| `TITLE_MODEL` | No | Model for conversation titles |
| `DEFAULT_CHAT_MODEL` | No | Default chat model |
| `DEFAULT_IMAGE_MODEL` | No | Default image model |
| `NEXT_PUBLIC_SITE_NAME` | No | App name in UI (default: "Daily Agent") |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Meta description (default: "Your AI productivity agent") |
