"use client";

import { getToday } from "@/lib/dates";
import { useState, useEffect } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { GoalPicker } from "@/components/goals/GoalPicker";
import { useToast } from "@/lib/toast-context";
import { Task, Space, Tag } from "@/types/database";

interface TaskFormModalProps {
  task?: Task | null;
  spaces?: Space[];
  defaultDate?: string;
  defaultSpaceId?: string;
  defaultGoalId?: string;
  /** Prefill title for new tasks (e.g. empty-state suggestions) */
  defaultTitle?: string;
  onClose: () => void;
  onSave: (task: Task) => void;
}

const PRIORITY_LABELS: Record<string, string> = { A: "Must Do", B: "Should Do", C: "Nice to Do" };

export function TaskFormModal({ task, spaces, defaultDate, defaultSpaceId, defaultGoalId, defaultTitle, onClose, onSave }: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title || defaultTitle || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [priority, setPriority] = useState(task?.priority || "B1");
  const [taskDate, setTaskDate] = useState(task?.task_date || defaultDate || getToday());
  const [spaceId, setSpaceId] = useState(task?.space_id || defaultSpaceId || "");
  const [goalId, setGoalId] = useState(task?.goal_id || defaultGoalId || "");
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrence?.type || "");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    () => task?.tags?.map((t) => t.id) ?? []
  );
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setAllTags(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const url = task ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = task ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        task_date: taskDate,
        space_id: spaceId || null,
        goal_id: goalId || null,
        recurrence: recurrenceType ? { type: recurrenceType } : null,
        tag_ids: selectedTagIds,
      };

      if (task?.updated_at) {
        body.expected_updated_at = task.updated_at;
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
          "This task was changed elsewhere. Close and reopen to see the latest.",
          "error",
          5000
        );
        return;
      }

      const err = await response.json().catch(() => ({}));
      addToast(err.error || "Failed to save task", "error", 4000);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save task", "error", 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal title={task ? "Edit Task" : "New Task"} onClose={onClose}>
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
            placeholder="What needs to be done?"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            rows={2}
            placeholder="Additional details..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Priority
          </label>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            A/B/C is importance; the number is sub-rank within it (1 = highest).
          </p>
          <div className="grid grid-cols-3 gap-1">
            {["A", "B", "C"].map((letter) => (
              <div key={letter}>
                <div className="text-xs mb-1 text-center" style={{ color: "var(--text-muted)" }}>
                  {PRIORITY_LABELS[letter]}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3].map((num) => {
                    const p = `${letter}${num}`;
                    const isSelected = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{
                          background: isSelected ? "var(--accent-primary)" : "var(--bg-base)",
                          color: isSelected ? "var(--bg-base)" : "var(--text-secondary)",
                          border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Date
            </label>
            <input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Recurrence
            </label>
            <select
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <GoalPicker value={goalId} onChange={setGoalId} />

        {spaces && spaces.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Space
            </label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              <option value="">No space</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {allTags.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="text-xs px-2 py-1 rounded-full font-medium transition-colors"
                    style={{
                      background: selected ? tag.color : "var(--bg-elevated)",
                      color: selected ? "var(--bg-base)" : "var(--text-secondary)",
                      border: `1px solid ${selected ? tag.color : "var(--border-default)"}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
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
            {isSaving ? "Saving..." : task ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
