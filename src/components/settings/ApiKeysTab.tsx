"use client";

import { useState } from "react";
import { Key, Plus, Copy, Trash2, AlertCircle } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function ApiKeysTab() {
  const [keys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            API Keys
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Generate API keys to connect Claude, ChatGPT, or other MCP clients to your Daily Agent data.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--accent-primary)",
            color: "var(--bg-base)",
          }}
        >
          <Plus className="w-4 h-4" />
          New Key
        </button>
      </div>

      {/* Created key display (shown once after creation) */}
      {createdKey && (
        <div
          className="rounded-lg p-4"
          style={{
            background: "rgba(74, 222, 128, 0.1)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--accent-positive)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2" style={{ color: "var(--accent-positive)" }}>
                Save this key now — you won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-xs px-3 py-2 rounded font-mono truncate"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {createdKey}
                </code>
                <button
                  onClick={handleCopyKey}
                  className="flex items-center gap-1 px-3 py-2 rounded text-xs font-medium transition-colors"
                  style={{
                    background: "var(--bg-elevated)",
                    color: copied ? "var(--accent-positive)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Key className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            No API keys yet
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Create an API key to connect your AI client via MCP.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Key className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {key.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {key.key_prefix}... · Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <button
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ color: "var(--accent-negative)" }}
                title="Revoke key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create key modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
            }}
          >
            <h3 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Create API Key
            </h3>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
                placeholder='e.g. "Claude Code", "Work laptop"'
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                Cancel
              </button>
              <button
                disabled={!newKeyName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "var(--accent-primary)",
                  color: "var(--bg-base)",
                }}
              >
                Create Key
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              API key generation will be available once the backend is wired up in Phase 4.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
