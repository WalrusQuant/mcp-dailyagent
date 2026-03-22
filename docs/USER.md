# User Guide

How to use Daily Agent — chat, productivity tools, agent mode, and customization.

---

## Getting Started

1. Open the app and click **Sign Up**
2. Enter your email, a password (8+ characters), and the access code provided by your admin
3. After signing in, you land on the **Dashboard** — your daily snapshot

---

## Chat

The core of the app. Navigate to **Chat** from the sidebar.

### Starting a conversation

Click the **New Chat** button or just start typing. A conversation is created automatically when you send your first message. The AI generates a title after the first response.

### Model selector

Click the model name above the input to switch models. You can change models mid-conversation — each message is processed by whichever model is selected when you send it.

### Streaming

Responses stream in real-time. Click **Stop** to cancel mid-stream — the partial response is saved automatically.

### Per-message info

Each assistant message shows token counts (input/output) and cost. Click the info icon to expand the details.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Cmd/Ctrl+Shift+S` | Toggle sidebar |

### Export

Click the menu icon on any conversation to export as **Markdown** or **JSON**. Exports include all messages, timestamps, and model information.

---

## Agent Mode vs Chat Mode

The app has two modes, toggled per conversation from the chat input area.

### Agent Mode (default)

The AI has access to 13 productivity tools. It can read your tasks, habits, goals, focus stats, journal entries, and workouts. It can also create tasks, log habits, start focus sessions, manage goals, and search past conversations.

- **Read-only tools** (7): Execute automatically — no approval needed
- **Mutation tools** (6): Show an approval card before executing — you confirm or reject each action
- **Search tool** (1): Searches past conversations using full-text search

When you ask "what's on my plate today?" or "create a task to review the API docs," the AI calls the appropriate tools.

### Chat Mode

A clean chatbot with no tool access. The AI still has your system prompt and memory notes, but can't interact with your productivity data. Use this for general conversation, coding help, brainstorming, writing, or anything that doesn't need your personal context.

The conversation search tool is available in both modes — the AI can always search past conversations.

### Switching modes

Toggle the mode icon in the chat input area. The setting persists per conversation. Switching mid-conversation is fine — agent mode adds tools, chat mode strips them.

---

## Productivity Tools

### Tasks

Franklin Covey A/B/C priority system with three tiers:
- **A** — Must do (critical, deadline-driven)
- **B** — Should do (important but not urgent)
- **C** — Could do (nice to have)

Each tier has positions 1-3 for ordering within the group. Drag tasks to reorder within their priority group.

**Features:**
- Daily rollover: Incomplete tasks from previous days can be rolled forward
- Recurrence: Set tasks to repeat daily, weekly, or monthly
- Project linking: Associate tasks with projects
- Notes: Add details to any task
- The AI can create and complete tasks via agent mode

### Habits

Weekly grid view showing each habit's completion across the current week. Toggle days by clicking the grid cells.

**Features:**
- Streak tracking with sparkline charts
- Completion rate badge (percentage)
- Expandable 30-day heatmap per habit
- Target days: Set which days of the week a habit applies
- The AI can log habits via agent mode

### Journal

Daily journal entries with auto-saving editor.

**Features:**
- Mood tracking (1-5 scale with emoji indicators)
- AI writing prompts: Click for a suggested journaling prompt
- Full-text search across all entries
- Date navigation to browse past entries

### Workouts

Template-based workout system.

**Features:**
- Create reusable workout templates with exercises
- Active workout logger: Track sets with weight and reps in real-time
- Stats: Total volume, personal records, weekly averages
- Exercise history

### Focus Timer

Pomodoro-style timer with visual progress.

**Features:**
- Circular progress display with countdown
- Link sessions to tasks (tracks focus time per task)
- 7-day bar chart of focus activity
- Top tasks by total focus time
- Timer persists across page navigation (context-based)

### Goals

Long-term goals with progress tracking.

**Features:**
- Set target dates and track percentage progress
- Link goals to tasks and habits (goal progress reflects linked item completion)
- The AI uses your goals to prioritize briefings and insights

### Dashboard

Your daily snapshot. Shows widgets for:
- Today's tasks (with completion count)
- Habit streaks
- Journal mood
- Recent workouts
- Focus sessions
- Goal progress
- Daily briefing (AI-generated)
- Insight cards (AI-generated)

The dashboard is the default landing page after sign-in.

### Weekly Review

AI-generated summary of your week. Covers:
- Tasks completed vs created
- Habit streaks and completion rates
- Journal mood trends
- Workout consistency
- Focus time totals
- Goal progress movement

Reviews are generated on demand. Click **Generate Review** to create one for the current week. Past reviews are browsable by week.

### Calendar

Monthly calendar view with activity dots per day. Each dot color represents a different tool (tasks, habits, journal, workouts, focus). Click any day to open a detail panel with a full breakdown of that day's activity.

---

## AI Features

### Daily Briefing

An AI-generated summary that appears on the Dashboard. It analyzes your tasks, habits, goals, and recent activity to give you a morning overview and suggested priorities.

- Cached per day — loads instantly on repeat visits
- Click **Refresh** to regenerate with updated data
- "Plan my day" link starts a chat conversation in agent mode

### Proactive Insights

AI-analyzed patterns across your tools. Appear as dismissable cards on the Dashboard:

- **Encouragement** — recognizing streaks, completed goals, consistent habits
- **Warnings** — overdue tasks, broken streaks, missed habits
- **Suggestions** — pattern-based recommendations (e.g., "You focus best in the morning")

### In-Tool AI Assist

Context-aware AI suggestions available within individual tools:

- **Journal**: AI reflection prompts based on your day
- **Tasks**: Task breakdown suggestions for large tasks
- **Habits**: Coaching tips based on your streaks and patterns
- **Workouts**: Exercise and progression suggestions
- **Weekly Review**: Enhanced analysis with AI commentary

### Conversation Search

The AI can search your past conversations. In agent mode, it does this automatically when relevant. In chat mode, you can also ask it to search — the search tool is available in both modes.

Example: "What did we discuss about the API redesign last week?" → The AI searches your message history and summarizes relevant results.

---

## Web Search

Toggle web search per-message using the search icon in the chat input area.

When enabled:
1. Your message is sent to Tavily for web search
2. Results are optionally summarized by a search model (configurable in Settings)
3. The AI receives the search results as context and cites sources inline
4. Source links appear below the message — click to expand

Configure search depth and result count in **Settings → Search**.

---

## Settings

### Profile Settings

- **System Prompt**: Override the default conversational prompt. Your custom prompt replaces the default for all conversations (unless a conversation or project has its own override).
- **Memory Notes**: "About Me" text that's injected into every conversation in both modes. Write anything the AI should always know — your role, preferences, projects, communication style.
- **Search Model**: Model used to summarize web search and conversation search results. Leave blank to skip summarization and pass raw results.
- **Search Results**: Number of results to return for basic and advanced search depth.

### AI Model Config

Override which model is used for specific AI tasks:

| Task | Description |
|------|-------------|
| **Briefing** | Daily briefing generation |
| **Insights** | Proactive insight analysis |
| **Assist** | In-tool AI suggestions |
| **Tools** | Tool-calling decisions in agent mode |

Leave blank to use the system default (title model for fast tasks, default chat model for assist).

### Feature Toggles

- **Context Injection**: Whether the AI can inject productivity context into the system prompt
- **Tool Calling**: Whether agent mode tools are available
- **Briefing**: Whether the daily briefing generates on the dashboard

### Theme

Toggle between **Light**, **Dark**, and **System** (follows your OS preference). The toggle is in the sidebar footer.

---

## Projects & Organization

### Projects

Create projects to group related conversations. Each project can have:
- A description
- A status (active, paused, completed)
- A progress percentage
- A custom system prompt (prepended to the active prompt for conversations in this project)

### Tags

Tag conversations for easy filtering. Create tags inline from any conversation. Filter by tag in the sidebar.

### Conversation-level prompts

Override the system prompt for individual conversations via the settings icon in the chat header. Prompt priority (highest wins):

1. **Conversation prompt** (if set)
2. **Project prompt** (if conversation is in a project with a prompt)
3. **Profile prompt** (if set in user settings)
4. **Default system prompt** (built-in)

Memory notes are always appended regardless of which prompt level is active.

---

## Usage & Budget

### Usage Dashboard

Navigate to **Usage** from the sidebar to see:
- Spending chart (daily/weekly/monthly view)
- Per-model cost breakdown
- Most-used models
- Token usage trends
- Current month's total spend

### Budget

Set a monthly budget in the Usage dashboard. The app shows:
- A warning banner at 80% of your budget
- A block at 100% — AI requests are rejected until the next month

Budget tracking is per calendar month and resets automatically.

---

## PWA (Install as App)

The app is installable as a Progressive Web App on any device:

- **iOS**: Open in Safari → Share → Add to Home Screen
- **Android**: Open in Chrome → Menu → Add to Home Screen (or accept the install prompt)
- **Desktop**: Click the install icon in the browser address bar

The PWA caches static assets for offline access. API calls (chat, data) require an internet connection.

### Mobile navigation

On mobile, the sidebar is replaced with a bottom navigation bar. The nav bar has safe area insets for notched devices (iPhone, etc.).
