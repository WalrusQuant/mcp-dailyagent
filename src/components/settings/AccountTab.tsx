"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { TIMEZONE_CHANGED_EVENT } from "@/lib/client-date-context";

export function AccountTab() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [toolCallingEnabled, setToolCallingEnabled] = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) {
          setLoadError(true);
          return;
        }
        const data = await res.json();
        setDisplayName(data.display_name || "");
        setEmail(data.email || null);
        setTimezone(data.timezone || "UTC");
        setToolCallingEnabled(data.tool_calling_enabled ?? true);
        setBriefingEnabled(data.briefing_enabled ?? true);
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName || null,
          timezone,
          tool_calling_enabled: toolCallingEnabled,
          briefing_enabled: briefingEnabled,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      window.dispatchEvent(new CustomEvent(TIMEZONE_CHANGED_EVENT, { detail: timezone }));
      addToast("Profile updated", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to save",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm py-8" style={{ color: "var(--text-muted)" }}>
        Couldn&apos;t load profile. Check that the app can reach the database.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Account
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your profile. AI generation lives in OpenClaw — this dashboard is your data UI.
        </p>
      </div>

      <div className="space-y-4">
        {email && (
          <div>
            <div className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Email
            </div>
            <p className="text-sm px-4 py-3 rounded-lg" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
              {email}
            </p>
          </div>
        )}
        <div>
          <label htmlFor="profile-display-name" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Display Name
          </label>
          <input
            id="profile-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="profile-timezone" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Timezone
          </label>
          <select
            id="profile-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {Intl.supportedValuesOf("timeZone").map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-3">
          <legend className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Agent Access
          </legend>
          <label className="flex items-start gap-3 rounded-lg px-4 py-3 cursor-pointer" style={{ background: "var(--bg-elevated)" }}>
            <input
              type="checkbox"
              checked={toolCallingEnabled}
              onChange={(event) => setToolCallingEnabled(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Allow agent tool calls</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Resources and prompts remain readable when agent tools are disabled.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg px-4 py-3 cursor-pointer" style={{ background: "var(--bg-elevated)" }}>
            <input
              type="checkbox"
              checked={briefingEnabled}
              onChange={(event) => setBriefingEnabled(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Show and store daily briefings</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Turning this off hides saved briefings and rejects new ones.</span>
            </span>
          </label>
        </fieldset>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: "var(--accent-primary)",
          color: "var(--bg-base)",
        }}
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </button>
    </div>
  );
}
