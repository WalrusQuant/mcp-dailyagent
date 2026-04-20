"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export function AccountTab() {
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        setDisplayName(data.displayName || "");
        setTimezone(data.timezone || "UTC");
      } catch {
        // non-fatal
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
        body: JSON.stringify({ displayName: displayName || null, timezone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Account
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your profile information.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
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
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
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
