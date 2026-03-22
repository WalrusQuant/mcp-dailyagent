"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save } from "lucide-react";

interface ConversationSettingsProps {
  conversationId: string;
  onClose: () => void;
}

export function ConversationSettings({ conversationId, onClose }: ConversationSettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [projectPrompt, setProjectPrompt] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.system_prompt || "");

        if (data.project_id) {
          const projRes = await fetch(`/api/projects/${data.project_id}`);
          if (projRes.ok) {
            const project = await projRes.json();
            setProjectPrompt(project.system_prompt || null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadConversation();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [conversationId, onClose, loadConversation]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: systemPrompt.trim() || null }),
      });
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl shadow-lg z-10"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Conversation Settings
          </h2>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Prompt hierarchy info */}
          <div className="text-xs space-y-1 p-3 rounded-lg" style={{ background: "var(--bg-base)" }}>
            <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
              Prompt priority (highest to lowest):
            </p>
            <ol className="list-decimal list-inside space-y-0.5" style={{ color: "var(--text-muted)" }}>
              <li>Project context {projectPrompt ? "(set)" : "(none)"}</li>
              <li>Conversation prompt (below)</li>
              <li>Profile default prompt</li>
              <li>System default</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Conversation System Prompt
            </label>
            {isLoading ? (
              <div className="py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
            ) : (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
                rows={6}
                placeholder="Custom instructions for this conversation..."
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
