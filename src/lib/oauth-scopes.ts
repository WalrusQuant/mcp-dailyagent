/** OAuth 2.1 scope definitions for MCP access */

export interface ScopeDefinition {
  scope: string;
  label: string;
  description: string;
  category: string;
}

export const OAUTH_SCOPES: ScopeDefinition[] = [
  // Tasks
  { scope: "tasks:read", label: "Read your tasks", description: "View tasks, priorities, and due dates", category: "Tasks" },
  { scope: "tasks:write", label: "Manage your tasks", description: "Create, update, complete, and delete tasks", category: "Tasks" },

  // Habits
  { scope: "habits:read", label: "Read your habits", description: "View habits, streaks, and completion stats", category: "Habits" },
  { scope: "habits:write", label: "Manage your habits", description: "Create, update, and toggle habit completions", category: "Habits" },

  // Journal
  { scope: "journal:read", label: "Read your journal", description: "View journal entries and search content", category: "Journal" },
  { scope: "journal:write", label: "Write journal entries", description: "Create and update journal entries", category: "Journal" },

  // Workouts
  { scope: "workouts:read", label: "Read your workouts", description: "View workout templates, logs, and stats", category: "Workouts" },
  { scope: "workouts:write", label: "Manage your workouts", description: "Create templates and log workouts", category: "Workouts" },

  // Focus
  { scope: "focus:read", label: "Read focus sessions", description: "View focus session history and stats", category: "Focus" },
  { scope: "focus:write", label: "Manage focus sessions", description: "Start and complete focus sessions", category: "Focus" },

  // Goals
  { scope: "goals:read", label: "Read your goals", description: "View goals and progress tracking", category: "Goals" },
  { scope: "goals:write", label: "Manage your goals", description: "Create goals and log progress", category: "Goals" },

  // Spaces
  { scope: "spaces:read", label: "Read your spaces", description: "View spaces and their details", category: "Spaces" },
  { scope: "spaces:write", label: "Manage your spaces", description: "Create and update spaces", category: "Spaces" },

  // Profile
  { scope: "profile:read", label: "Read your profile", description: "View profile and settings", category: "Profile" },
  { scope: "profile:write", label: "Update your profile", description: "Modify profile settings", category: "Profile" },

  // Calendar
  { scope: "calendar:read", label: "Read your calendar", description: "View daily and weekly summaries", category: "Calendar" },

  // Briefings & Reviews & Insights
  { scope: "briefing:read", label: "Read daily briefings", description: "View daily briefings saved by OpenClaw", category: "Briefings" },
  { scope: "briefing:write", label: "Save daily briefings", description: "Create and overwrite daily briefings", category: "Briefings" },
  { scope: "review:read", label: "Read weekly reviews", description: "View weekly review summaries", category: "Reviews" },
  { scope: "review:write", label: "Save weekly reviews", description: "Create and overwrite weekly reviews", category: "Reviews" },
  { scope: "insights:read", label: "Read insights", description: "View cached insights saved by OpenClaw", category: "Insights" },
  { scope: "insights:write", label: "Save insights", description: "Create and overwrite cached insights", category: "Insights" },

  // Convenience
  { scope: "all", label: "Full access", description: "Read and write access to all your data", category: "All" },
];

/** All valid scope strings */
export const VALID_SCOPES = OAUTH_SCOPES.map((s) => s.scope);

/** Get human-readable label for a scope */
export function getScopeLabel(scope: string): string {
  return OAUTH_SCOPES.find((s) => s.scope === scope)?.label ?? scope;
}

/** Get description for a scope */
export function getScopeDescription(scope: string): string {
  return OAUTH_SCOPES.find((s) => s.scope === scope)?.description ?? "";
}

/** Group scopes by category for display */
export function groupScopesByCategory(scopes: string[]): Record<string, ScopeDefinition[]> {
  const grouped: Record<string, ScopeDefinition[]> = {};
  for (const scope of scopes) {
    const def = OAUTH_SCOPES.find((s) => s.scope === scope);
    if (def) {
      if (!grouped[def.category]) grouped[def.category] = [];
      grouped[def.category].push(def);
    }
  }
  return grouped;
}

/** Expand "all" scope into individual scopes */
export function expandScopes(scopes: string[]): string[] {
  if (scopes.includes("all")) {
    return OAUTH_SCOPES.filter((s) => s.scope !== "all").map((s) => s.scope);
  }
  return scopes;
}
