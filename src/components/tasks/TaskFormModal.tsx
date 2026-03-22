"use client";

import { useState } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { GoalPicker } from "@/components/goals/GoalPicker";
import { Task, Project } from "@/types/database";

interface TaskFormModalProps {
  task?: Task | null;
  projects?: Project[];
  defaultDate?: string;
  defaultProjectId?: string;
  onClose: () => void;
  onSave: (task: Task) => void;
}

const PRIORITY_LABELS: Record<string, string> = { A: "Must Do", B: "Should Do", C: "Nice to Do" };

export function TaskFormModal({ task, projects, defaultDate, defaultProjectId, onClose, onSave }: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [priority, setPriority] = useState(task?.priority || "B1");
  const [taskDate, setTaskDate] = useState(task?.task_date || defaultDate || new Date().toISOString().split("T")[0]);
  const [projectId, setProjectId] = useState(task?.project_id || defaultProjectId || "");
  const [goalId, setGoalId] = useState(task?.goal_id || "");
  const [recurrenceType, setRecurrenceType] = useState(task?.recurrence?.type || "");
  const [isSaving, setIsSaving] = useState(false);

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
        project_id: projectId || null,
        goal_id: goalId || null,
        recurrence: recurrenceType ? { type: recurrenceType } : null,
      };

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
      console.error("Failed to save task:", error);
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
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Priority
          </label>
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

        {projects && projects.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
