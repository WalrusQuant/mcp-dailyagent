"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Space } from "@/types/database";

interface SpaceFormModalProps {
  space?: Space | null;
  onClose: () => void;
  onSave: (space: Space) => void;
}

export function SpaceFormModal({ space, onClose, onSave }: SpaceFormModalProps) {
  const [name, setName] = useState(space?.name || "");
  const [description, setDescription] = useState(space?.description || "");
  const [status] = useState<"active" | "paused" | "completed">(space?.status || "active");
  const [deadline] = useState(space?.deadline || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const url = space ? `/api/spaces/${space.id}` : "/api/spaces";
      const method = space ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          deadline: deadline || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
      }
    } catch (error) {
      console.error("Failed to save space:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-xl shadow-lg z-10 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", width: "420px", maxWidth: "calc(100vw - 2rem)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {space ? "Edit Space" : "New Space"}
          </h2>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              placeholder="Space name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              rows={3}
              placeholder="What is this space about?"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {isSaving ? "Saving..." : space ? "Save Changes" : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
