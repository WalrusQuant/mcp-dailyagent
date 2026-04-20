"use client";

import { useState } from "react";
import { AlertTriangle, Download, Trash2, Loader2 } from "lucide-react";

const CONFIRM_PHRASE = "wipe all data";

export function DangerZoneTab() {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeSuccess, setWipeSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    // TODO: Wire up data export in a later phase
    setTimeout(() => setIsExporting(false), 1000);
  };

  const handleWipe = async () => {
    setIsWiping(true);
    setWipeError(null);
    try {
      const res = await fetch("/api/wipe-data", { method: "POST" });
      if (res.ok) {
        setWipeSuccess(true);
        setShowWipeConfirm(false);
        setConfirmText("");
        // Brief pause so user sees the success state, then reload
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setWipeError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      setWipeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--accent-negative)" }}>
          Danger Zone
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Irreversible actions. Proceed with caution.
        </p>
      </div>

      {/* Export Data */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Export Data
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Download all your data as JSON. Includes tasks, habits, journal entries, workouts, goals, and reviews.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export
          </button>
        </div>
      </div>

      {/* Wipe All Data */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(248, 113, 113, 0.3)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--accent-negative)" }}>
              Wipe All Data
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Delete every task, habit, habit log, journal entry, workout template, workout log, focus session, goal, goal progress log, space, tag, weekly review, daily briefing, and cached insight. Your profile stays, everything else is gone.
            </p>
          </div>
          {!showWipeConfirm && !wipeSuccess ? (
            <button
              onClick={() => {
                setShowWipeConfirm(true);
                setWipeError(null);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
              style={{
                color: "var(--accent-negative)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              <Trash2 className="w-4 h-4" />
              Wipe
            </button>
          ) : null}
        </div>

        {wipeSuccess && (
          <div
            className="mt-4 flex items-start gap-2 rounded-lg p-3"
            style={{ background: "rgba(74, 222, 128, 0.1)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-primary)" }}>
              All data wiped. Reloading...
            </p>
          </div>
        )}

        {showWipeConfirm && !wipeSuccess && (
          <div className="mt-4 space-y-3">
            <div
              className="flex items-start gap-2 rounded-lg p-3"
              style={{ background: "rgba(248, 113, 113, 0.1)" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-negative)" }} />
              <div className="text-xs space-y-1" style={{ color: "var(--accent-negative)" }}>
                <p className="font-semibold">This cannot be undone.</p>
                <p>
                  There is no trash, no backup, no recovery. Every row in every productivity table will be deleted. If you need a snapshot, export first.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                Type <strong>{CONFIRM_PHRASE}</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(248, 113, 113, 0.3)",
                }}
                placeholder={CONFIRM_PHRASE}
                autoFocus
              />
            </div>
            {wipeError && (
              <p className="text-xs" style={{ color: "var(--accent-negative)" }}>
                Error: {wipeError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWipeConfirm(false);
                  setConfirmText("");
                  setWipeError(null);
                }}
                disabled={isWiping}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={confirmText !== CONFIRM_PHRASE || isWiping}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
                style={{
                  background: "var(--accent-negative)",
                  color: "white",
                }}
              >
                {isWiping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wiping...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Wipe Everything
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
