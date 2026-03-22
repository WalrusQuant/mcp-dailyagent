# Supabase Setup

## 1. Create Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

## 2. Add Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

At minimum you need:
- `NEXT_PUBLIC_SUPABASE_URL` - Find in: Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Find in: Supabase Dashboard → Settings → API
- `OPENROUTER_API_KEY` - Get at https://openrouter.ai/keys
- `SIGNUP_SECRET` - Any string you choose

See `.env.example` for optional vars (Tavily web search, title model).

## 3. Run Database Migrations

Go to Supabase Dashboard → SQL Editor → New Query.

Run each migration file in order from `supabase/migrations/`:

| File | What it does |
|------|-------------|
| `001_initial_schema.sql` | Profiles, conversations, messages tables + RLS + auto-profile trigger |
| `002_message_token_tracking.sql` | Adds token/cost tracking columns to messages |
| `003_generated_images.sql` | Generated images table + RLS |
| `004_app_models.sql` | App models table (managed from Settings UI) |

Run them one at a time in order.

## 4. Configure Auth Settings

In Supabase Dashboard → Authentication → Providers:

- Make sure **Email** is enabled
- Optionally disable "Confirm email" for easier testing

## 5. Run the App

```bash
npm run dev
```

Open http://localhost:3000 and sign up!

Models are managed from the Settings page — they auto-seed on first load.
