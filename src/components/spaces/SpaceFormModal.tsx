"use client";

import { useId, useState } from "react";
import { useToast } from "@/lib/toast-context";
import { Space } from "@/types/database";
import { FormModal } from "@/components/shared/FormModal";

interface SpaceFormModalProps {
  space?: Space | null;
  onClose: () => void;
  onSave: (space: Space) => void;
}

export function SpaceFormModal({ space, onClose, onSave }: SpaceFormModalProps) {
  const [name, setName] = useState(space?.name || "");
  const [description, setDescription] = useState(space?.description || "");
  const [status, setStatus] = useState<"active" | "paused" | "completed">(space?.status || "active");
  const [deadline, setDeadline] = useState(space?.deadline || "");
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();
  const id = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const url = space ? `/api/spaces/${space.id}` : "/api/spaces";
      const method = space ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        deadline: deadline || null,
      };
      if (space?.updated_at) {
        body.expected_updated_at = space.updated_at;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
        return;
      }

      if (response.status === 409) {
        addToast(
          "This space was changed elsewhere. Close and reopen to see the latest.",
          "error",
          5000
        );
        return;
      }

      const err = await response.json().catch(() => ({}));
      addToast(err.error || "Failed to save space", "error", 4000);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save space", "error", 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal title={space ? "Edit Space" : "New Space"} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${id}-name`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Name *
            </label>
            <input
              type="text"
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              placeholder="Space name"
              data-autofocus
            />
          </div>

          <div>
            <label htmlFor={`${id}-description`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              id={`${id}-description`}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-status`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Status
              </label>
              <select
                id={`${id}-status`}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "paused" | "completed")}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-deadline`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Deadline
              </label>
              <input
                id={`${id}-deadline`}
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
              />
            </div>
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
    </FormModal>
  );
}
