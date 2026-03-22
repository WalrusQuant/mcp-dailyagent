# Customization Guide

How to rebrand, retheme, extend, and customize the app.

---

## Branding

### App name

Set `NEXT_PUBLIC_SITE_NAME` in your environment variables. This changes:
- The sidebar header
- The browser tab title
- The PWA manifest name
- The meta tags

Default: `Daily Agent`

### App description

Set `NEXT_PUBLIC_SITE_DESCRIPTION` in your environment variables. This changes the meta description tag.

Default: `Your AI productivity agent`

### Icons

Replace these files in `/public/` to rebrand the app icons:

| File | Size | Usage |
|------|------|-------|
| `icon-192.png` | 192×192 | PWA icon, favicon |
| `icon-512.png` | 512×512 | PWA splash screen |
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `icon-maskable-512.png` | 512×512 | Android adaptive icon (safe zone: center 80%) |

After replacing icons, update `manifest.json` in `/public/` if you change the icon filenames or want to adjust the theme colors.

### Favicon

The favicon is served from `/public/favicon.ico`. Replace it with your own.

---

## Theming

### Built-in themes

The app ships with three themes:
- **Dark** (default) — dark background with warm amber accents
- **Light** — clean light background with slightly darker amber accents
- **System** — follows the user's OS preference

Users toggle themes from the sidebar footer.

### Modifying colors

All theme colors are defined as CSS variables in `src/app/globals.css`. The two sections to edit:

```css
/* Dark theme */
:root {
  --bg-primary: #1a1b1e;
  --bg-secondary: #2a2b2e;
  --bg-tertiary: #3a3b3e;
  --text-primary: #e8e4e0;
  --text-secondary: #a8a4a0;
  --text-tertiary: #888480;
  --accent: #d4a574;
  --accent-hover: #e0b584;
  --border: #3a3b3e;
  /* ... more variables */
}

/* Light theme */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f0;
  --text-primary: #1a1a1a;
  --accent: #b8845a;
  /* ... */
}
```

### Changing the accent color

The accent color is used for:
- Active states, links, and buttons
- The sidebar active item highlight
- User message background tints
- Feature cards and badges

To change it, update `--accent` (and `--accent-hover`) in both the dark and light theme sections of `globals.css`. Pick a pair that works on both dark and light backgrounds.

All components reference these variables via inline styles (`style={{ color: "var(--text-primary)" }}`), so changes propagate automatically.

---

## System Prompt

The default system prompt defines the AI's personality and response style. It's defined in `src/lib/system-prompt.ts`.

### Default behavior

The built-in prompt creates a direct, opinionated AI that:
- Talks like a sharp friend, not a help desk
- Skips filler ("Great question!", "I'd be happy to help")
- Matches response length to question complexity
- Has opinions and picks sides when asked
- Uses formatting only when content is genuinely structured

### Customization levels

Prompts override in this order (highest priority first):

1. **Conversation-level**: Set via the settings icon in the chat header. Applies only to that conversation.
2. **Project-level**: Set on the project. Prepended to the active prompt for all conversations in that project.
3. **User-level**: Set in Settings → System Prompt. Replaces the default for all conversations.
4. **Default**: The built-in prompt in `system-prompt.ts`. Always active as a fallback.

**Memory notes** (set in Settings → Memory Notes) are appended to whatever prompt is active. They're always included in both agent and chat modes.

### Editing the default prompt

To change the default personality for all users, edit `src/lib/system-prompt.ts`:

```typescript
export const SYSTEM_PROMPT = `Your custom prompt here...`;
```

This is a code change — it requires redeployment. For per-user customization without code changes, use the Settings page.

---

## Adding Tools

The app has 13 built-in tools for agent mode. To add a custom tool:

### 1. Define the tool

Add the tool definition to `src/lib/tools/definitions.ts`:

```typescript
// In the PRODUCTIVITY_TOOLS array:
{
  type: "function",
  function: {
    name: "your_tool_name",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "Parameter description" },
      },
      required: ["param1"],
    },
  },
},
```

If the tool is read-only (doesn't modify data), add it to the `READ_ONLY_TOOLS` set:

```typescript
export const READ_ONLY_TOOLS = new Set([
  "get_tasks", "get_habits", /* ... existing tools ... */,
  "your_tool_name",  // Add here if read-only
]);
```

Read-only tools auto-execute. Tools not in this set show an approval card and require user confirmation.

### 2. Implement the executor

Add the tool's logic to `src/lib/tools/executor.ts`. The executor receives the tool name, arguments, and user ID:

```typescript
// In the switch statement inside executeTool():
case "your_tool_name": {
  const { param1 } = args;
  // Your logic here — typically a Supabase query
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("your_table")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true, data };
}
```

### 3. Update the tool allowlist

The tool execution endpoint validates tool names against an allowlist. Add your tool to the `ALLOWED_TOOLS` set in `src/app/api/chat/tool-execute/route.ts`:

```typescript
const ALLOWED_TOOLS = new Set([
  "create_task", "complete_task", /* ... existing tools ... */,
  "your_tool_name",
]);
```

### 4. Update instructions (optional)

If the AI needs specific guidance on when to use your tool, update `TOOL_SYSTEM_INSTRUCTIONS` in `src/lib/tools/definitions.ts`.

---

## Database Schema

### Adding tables

1. Write SQL to create your table with RLS policies in `supabase/migrations/schema.sql` (append to the end)
2. Run the new SQL in the Supabase SQL Editor
3. Add TypeScript types to `src/types/database.ts`

### RLS policy pattern

Every table follows the same pattern:

```sql
CREATE TABLE public.your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- your columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON public.your_table
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own data" ON public.your_table
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON public.your_table
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON public.your_table
  FOR DELETE USING (auth.uid() = user_id);
```

---

## Adding Pages

### Protected pages

Add new pages under `src/app/(protected)/your-page/page.tsx`. These are automatically protected by the middleware — unauthenticated users are redirected to `/login`.

### Adding to the sidebar

Edit `src/components/layout/Sidebar.tsx` to add a navigation link. The sidebar has a collapsible "Tools" group for productivity tools — add your link there or to the main navigation.

### Adding to mobile navigation

Edit `src/components/layout/BottomNav.tsx` to add a tab for mobile users.

---

## API Routes

### Pattern

All API routes follow the same pattern:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Your logic here
  const { data, error } = await supabase
    .from("your_table")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

### Auth check

Every API route must verify the user via `supabase.auth.getUser()`. The Supabase server client uses cookies to maintain the session — no manual token handling needed.

### Rate limiting

To add rate limiting to a new endpoint, import and call the rate limiter:

```typescript
import { checkRateLimit } from "@/lib/rate-limit";

// Inside your handler:
const rateLimitResult = checkRateLimit(user.id, "your-category");
if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
  );
}
```
