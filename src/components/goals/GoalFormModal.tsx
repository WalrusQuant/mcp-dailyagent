"use client";

import { useState } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { Goal } from "@/types/database";

interface GoalFormModalProps {
  goal?: Goal | null;
  onClose: () => void;
  onSave: (goal: Goal) => void;
}

const CATEGORIES = [
  { value: "personal", label: "Personal" },
  { value: "health", label: "Health" },
  { value: "career", label: "Career" },
  { value: "financial", label: "Financial" },
  { value: "learning", label: "Learning" },
  { value: "relationships", label: "Relationships" },
  { value: "other", label: "Other" },
];

export function GoalFormModal({ goal, onClose, onSave }: GoalFormModalProps) {
  const [title, setTitle] = useState(goal?.title || "");
  const [description, setDescription] = useState(goal?.description || "");
  const [category, setCategory] = useState<string>(goal?.category || "personal");
  const [targetDate, setTargetDate] = useState(goal?.target_date || "");
  const [progressMode, setProgressMode] = useState(goal?.progress_mode || "auto");
  const [progress, setProgress] = useState(goal?.progress || 0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const url = goal ? `/api/goals/${goal.id}` : "/api/goals";
      const method = goal ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        target_date: targetDate || null,
        progress_mode: progressMode,
      };

      if (progressMode === "manual") {
        body.progress = progress;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
      }
    } catch (error) {
      console.error("Failed to save goal:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal title={goal ? "Edit Goal" : "New Goal"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            placeholder="What do you want to achieve?"
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
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            rows={2}
            placeholder="Why is this important?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Progress Tracking
          </label>
          <div className="flex gap-2">
            {(["auto", "manual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setProgressMode(mode)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: progressMode === mode ? "var(--accent-primary)" : "var(--bg-base)",
                  color: progressMode === mode ? "var(--bg-base)" : "var(--text-secondary)",
                  border: `1px solid ${progressMode === mode ? "var(--accent-primary)" : "var(--border-default)"}`,
                }}
              >
                {mode === "auto" ? "Auto (from tasks/habits)" : "Manual"}
              </button>
            ))}
          </div>
        </div>

        {progressMode === "manual" && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Progress: {progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            {isSaving ? "Saving..." : goal ? "Save Changes" : "Add Goal"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
