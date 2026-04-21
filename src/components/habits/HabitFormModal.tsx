"use client";

import { useState } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { GoalPicker } from "@/components/goals/GoalPicker";
import { useToast } from "@/lib/toast-context";
import { Habit } from "@/types/database";

interface HabitFormModalProps {
  habit?: Habit | null;
  onClose: () => void;
  onSave: (habit: Habit) => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#d4a574", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

export function HabitFormModal({ habit, onClose, onSave }: HabitFormModalProps) {
  const [name, setName] = useState(habit?.name || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [frequency, setFrequency] = useState<"daily" | "weekly">(habit?.frequency || "daily");
  const [targetDays, setTargetDays] = useState<number[]>(habit?.target_days || [1, 2, 3, 4, 5, 6, 7]);
  const [color, setColor] = useState(habit?.color || "#d4a574");
  const [goalId, setGoalId] = useState(habit?.goal_id || "");
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const toggleDay = (day: number) => {
    setTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const url = habit ? `/api/habits/${habit.id}` : "/api/habits";
      const method = habit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        frequency,
        target_days: targetDays,
        color,
        goal_id: goalId || null,
      };
      if (habit?.updated_at) {
        body.expected_updated_at = habit.updated_at;
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
          "This habit was changed elsewhere. Close and reopen to see the latest.",
          "error",
          5000
        );
        return;
      }

      const err = await response.json().catch(() => ({}));
      addToast(err.error || "Failed to save habit", "error", 4000);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save habit", "error", 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal title={habit ? "Edit Habit" : "New Habit"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            placeholder="e.g., Morning meditation"
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Target Days
          </label>
          <div className="flex gap-1">
            {DAY_NAMES.map((name, i) => {
              const day = i + 1;
              const isActive = targetDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="flex-1 py-3 md:py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? color : "var(--bg-base)",
                    color: isActive ? "white" : "var(--text-secondary)",
                    border: `1px solid ${isActive ? color : "var(--border-default)"}`,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Color
          </label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-9 h-9 md:w-7 md:h-7 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: color === c ? "scale(1.2)" : undefined,
                  boxShadow: color === c ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <GoalPicker value={goalId} onChange={setGoalId} />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            {isSaving ? "Saving..." : habit ? "Save Changes" : "Add Habit"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
