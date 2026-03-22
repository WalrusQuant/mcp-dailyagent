"use client";

import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor } from "lucide-react";

export function PreferencesTab() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    { id: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Preferences
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Customize your dashboard appearance.
        </p>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          Theme
        </label>
        <div className="flex gap-2">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: theme === id ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: theme === id ? "var(--bg-base)" : "var(--text-secondary)",
                border: `1px solid ${theme === id ? "var(--accent-primary)" : "var(--border-default)"}`,
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
