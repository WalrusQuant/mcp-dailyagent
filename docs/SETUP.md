# Setup Guide

Step-by-step deployment guide for Daily Agent. Covers Supabase, Vercel, and first-run configuration.

---

## Prerequisites

- **Node.js 18+** (for local development)
- **npm** (ships with Node.js)
- A **Supabase** account ([supabase.com](https://supabase.com) — free tier works)
- At least one AI provider API key:
  - [Anthropic](https://console.anthropic.com/) (Claude)
  - [Google AI Studio](https://aistudio.google.com/) (Gemini)
  - [OpenAI](https://platform.openai.com/) (GPT)
  - [OpenRouter](https://openrouter.ai/) (any model)
- Optional: [Tavily](https://tavily.com) API key for web search (free tier: 1,000 searches/month)

---

## 1. Supabase Setup

### Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Choose a region close to your users (or close to your Vercel deployment region)
3. Set a strong database password — you won't need it for the app, but keep it safe
4. Wait for the project to finish provisioning (~2 minutes)

### Get your API credentials

1. Go to **Settings → API** in the Supabase dashboard
2. Copy these two values — you'll need them for environment variables:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Run the database migration

1. Go to **SQL Editor** in the Supabase dashboard
2. Click **New Query**
3. Open `supabase/migrations/schema.sql` from the repository and paste the entire contents
4. Click **Run**

This single file creates everything: all tables, indexes, row-level security policies, triggers (auto-create profile on signup), and the `project-files` storage bucket. Every table has RLS enabled — users can only access their own data.

If you need to re-run it later (e.g., after pulling updates), Supabase will skip objects that already exist. It's safe to run multiple times.

### Configure authentication

The app uses Supabase email/password authentication by default. No additional auth configuration is required — it works out of the box.

**Optional: Enable OAuth providers**

If you want Google, GitHub, or other social login:

1. Go to **Authentication → Providers** in the Supabase dashboard
2. Enable the provider you want
3. Follow Supabase's guide to set up OAuth credentials for that provider
4. Add the callback URL to your OAuth app configuration: `https://your-project.supabase.co/auth/v1/callback`

Note: The app's signup flow requires a secret code (`SIGNUP_SECRET`), which only applies to email/password signups. If you enable OAuth, users can sign in without the secret code (Supabase handles user creation directly). Plan your access control accordingly.

### Storage (automatic)

The migration script creates the `project-files` storage bucket automatically with RLS policies. Users can only access files in their own folder (`{user_id}/`). No manual storage configuration needed.

---

## 2. GitHub Setup

### Clone the repository

```bash
git clone https://github.com/your-username/daily-agent.git
cd daily-agent
npm install
```

### Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# Required — encrypts provider API keys stored in the database
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-char-hex-string

# Required — secret code for account creation
SIGNUP_SECRET=your-secret-code

# Optional — enables web search in chat
TAVILY_API_KEY=tvly-...
```

That's it for environment variables. Provider API keys (Anthropic, Google, OpenAI, OpenRouter) are configured from the Admin panel inside the app — not in env vars.

**Important:** Use the same `ENCRYPTION_KEY` across all deployments. If you change it, previously encrypted API keys in the database become unreadable. Generate one now and save it somewhere safe.

### Verify local setup

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the login page.

---

## 3. Vercel Deployment

### Option A: Deploy via GitHub (recommended)

1. Push your repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Set the environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `ENCRYPTION_KEY` | Your 64-character hex string |
| `SIGNUP_SECRET` | Your signup secret code |
| `TAVILY_API_KEY` | *(optional)* Tavily API key |

4. Click **Deploy**

Vercel auto-detects Next.js and configures the build. No framework or build settings to change.

### Option B: Deploy via Vercel CLI (no GitHub)

```bash
# Install the Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time — follow the prompts)
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add ENCRYPTION_KEY
vercel env add SIGNUP_SECRET
vercel env add TAVILY_API_KEY

# Redeploy with env vars
vercel --prod
```

### Update Supabase auth redirect

After deploying, update Supabase to allow redirects from your Vercel domain:

1. Go to **Authentication → URL Configuration** in the Supabase dashboard
2. Set **Site URL** to your Vercel domain (e.g., `https://your-app.vercel.app`)
3. Add the domain to **Redirect URLs**: `https://your-app.vercel.app/**`

---

## 4. First-Run Walkthrough

### Create your admin account

1. Open your deployed app
2. Click **Sign Up**
3. Enter your email, password, and the `SIGNUP_SECRET` code
4. Go to the Supabase SQL Editor and grant yourself admin:

```sql
UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
```

5. Refresh the app — you'll now see the admin panel in Settings

### Add AI providers

1. Go to **Settings** (gear icon in sidebar)
2. Scroll to **Provider Management**
3. Click **Add Provider** and enter your API key for at least one provider:
   - **Anthropic** — for Claude models
   - **Google** — for Gemini models
   - **OpenAI** — for GPT models
   - **OpenRouter** — for any model (acts as a proxy)
4. Use the **Test** button next to each provider to verify the key works

Keys are encrypted with AES-256-GCM before storage. They never appear in plaintext in the database or in API responses.

### Add models

1. Still in Settings, scroll to **Model Management**
2. Click **Add Model** for each model you want available:
   - **Model ID** — the provider's model identifier (e.g., `claude-sonnet-4-5-20250514`, `gemini-2.5-flash`, `gpt-4o`)
   - **Display Name** — what users see (e.g., "Claude Sonnet 4.5", "Gemini Flash", "GPT-4o")
   - **Provider** — which provider serves this model
   - **Type** — `chat` or `image`
   - **Input/Output Pricing** — cost per million tokens (for usage tracking)
   - **Default** — toggle on for the model you want selected by default
   - **Sort Order** — controls display order in the model selector
3. Add at least one chat model — the app won't work without one

### Configure optional settings

- **TITLE_MODEL** (env var or admin setting): Model used for auto-generating conversation titles. Pick something fast and cheap (e.g., `google/gemini-3-flash-preview`). The default works well.
- **DEFAULT_IMAGE_MODEL** (env var or admin setting): Model for image generation (e.g., `google/gemini-2.5-flash-image`).
- **Site Name** (`NEXT_PUBLIC_SITE_NAME` env var): Changes the app name in the header, browser tab, and PWA manifest.

### Invite users

Share your `SIGNUP_SECRET` with people you want to grant access. They'll sign up at `/signup` with their email, a password, and the secret code. Profiles are created automatically on signup.

To set usage limits for users:
1. Go to **Settings → Usage Limits**
2. Set per-user monthly budget caps and daily conversation limits
3. Admin accounts bypass all limits

---

## 5. Model Recommendations

### Chat models (pick one to start)

| Model | Provider | Best for | Cost |
|-------|----------|----------|------|
| `claude-sonnet-4-5-20250514` | Anthropic | Best all-around. Strong reasoning, good at following instructions, fast. | ~$3/$15 per M tokens |
| `gemini-2.5-flash` | Google | Fast and cheap. Good for routine tasks and quick questions. | ~$0.15/$0.60 per M tokens |
| `gpt-4o` | OpenAI | Strong general-purpose. Good with structured output. | ~$2.50/$10 per M tokens |
| `claude-opus-4-6` | Anthropic | Most capable. Use for complex analysis, planning, coding. | ~$15/$75 per M tokens |

### Title generation model

The title model auto-generates conversation titles after the first response. Pick the cheapest, fastest model you have access to:

- **Recommended:** `google/gemini-3-flash-preview` (default) — fast, cheap, good at short summaries
- **Alternative:** Any flash/mini model from your providers

### Image generation model

- **Recommended:** `google/gemini-2.5-flash-image` (default) — generates images via Gemini

### AI task models (briefing, insights, assist)

These are configurable per-user in Settings under "AI Model Config":

| Task | Description | Recommendation |
|------|-------------|----------------|
| **Briefing** | Daily morning briefing generation | Fast model (Gemini Flash, Haiku) |
| **Insights** | Proactive pattern analysis | Fast model — runs on dashboard load |
| **Assist** | In-tool AI suggestions (journal prompts, task breakdown) | Default chat model |
| **Tools** | Model used for tool-calling decisions | Fast model |

### Cost guidance

Short, directed productivity conversations (agent mode) typically use 500-2,000 tokens per exchange. With Gemini Flash, that's fractions of a cent. Even with Claude Sonnet, a typical daily usage pattern (morning briefing, a few agent conversations, some chat) costs under $0.50/day.

The app tracks every token and shows real-time cost per message. Set a monthly budget in the usage dashboard to get alerts at 80% and 100% thresholds.

---

## Troubleshooting

### "No models available" in chat

You need to add models as an admin. See [Add models](#add-models) above. Make sure you've run the `UPDATE profiles SET is_admin = true` query and refreshed the page.

### Supabase RLS errors (403 / "new row violates row-level security")

Make sure you ran the **full** `schema.sql` file — it includes all RLS policies. If you only ran part of it, re-run the entire file. Supabase will skip objects that already exist.

### Provider returns 401 or 403

The API key for that provider is missing or invalid. Go to Settings → Provider Management and verify the key. Check for trailing spaces. Use the **Test** button to verify connectivity.

### Web search toggle doesn't appear

`TAVILY_API_KEY` is not set. Add it to your environment variables and restart/redeploy.

### "Module not found" or build errors after pulling updates

Run `npm install` — dependencies may have changed.

### PWA not updating

The service worker caches aggressively. Hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) or clear the service worker in DevTools → Application → Service Workers.

### Encrypted keys become unreadable after redeployment

You changed or lost the `ENCRYPTION_KEY`. Use the same key across all deployments. If the key is lost, you'll need to re-enter all provider API keys in the admin panel.

### Signup says "Signup is disabled"

`SIGNUP_SECRET` is not set in your environment variables. Add it and redeploy.
