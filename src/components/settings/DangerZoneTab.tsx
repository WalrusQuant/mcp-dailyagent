"use client";

import { useState } from "react";
import { AlertTriangle, Download, Trash2, Loader2 } from "lucide-react";

export function DangerZoneTab() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    // TODO: Wire up data export in a later phase
    setTimeout(() => setIsExporting(false), 1000);
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

      {/* Delete Account */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(248, 113, 113, 0.3)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--accent-negative)" }}>
              Delete Account
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
              style={{
                color: "var(--accent-negative)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : null}
        </div>

        {showDeleteConfirm && (
          <div className="mt-4 space-y-3">
            <div
              className="flex items-start gap-2 rounded-lg p-3"
              style={{
                background: "rgba(248, 113, 113, 0.1)",
              }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-negative)" }} />
              <p className="text-xs" style={{ color: "var(--accent-negative)" }}>
                This will permanently delete your account, all your data, cancel any active subscription, and revoke all API keys. This action cannot be reversed.
              </p>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                Type <strong>delete my account</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(248, 113, 113, 0.3)",
                }}
                placeholder="delete my account"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmText !== "delete my account"}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
                style={{
                  background: "var(--accent-negative)",
                  color: "white",
                }}
              >
                Permanently Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
