"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { WorkoutTemplate, WorkoutExercise } from "@/types/database";

interface TemplateFormModalProps {
  template?: (WorkoutTemplate & { workout_exercises?: WorkoutExercise[] }) | null;
  onClose: () => void;
  onSave: (template: WorkoutTemplate) => void;
}

interface ExerciseInput {
  name: string;
  exercise_type: "strength" | "timed" | "cardio";
  default_sets: number;
  default_reps: number;
  default_weight: number;
  default_duration: number;
}

export function TemplateFormModal({ template, onClose, onSave }: TemplateFormModalProps) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [exercises, setExercises] = useState<ExerciseInput[]>(
    template?.workout_exercises?.map((e) => ({
      name: e.name,
      exercise_type: e.exercise_type,
      default_sets: e.default_sets || 3,
      default_reps: e.default_reps || 10,
      default_weight: e.default_weight || 0,
      default_duration: e.default_duration || 60,
    })) || [{ name: "", exercise_type: "strength", default_sets: 3, default_reps: 10, default_weight: 0, default_duration: 60 }]
  );
  const [isSaving, setIsSaving] = useState(false);

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: "", exercise_type: "strength", default_sets: 3, default_reps: 10, default_weight: 0, default_duration: 60 }]);
  };

  const updateExercise = (index: number, field: string, value: string | number) => {
    setExercises((prev) => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || exercises.some((ex) => !ex.name.trim())) return;

    setIsSaving(true);
    try {
      const url = template ? `/api/workouts/templates/${template.id}` : "/api/workouts/templates";
      const method = template ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          exercises: exercises.map((ex, i) => ({ ...ex, sort_order: i })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
      }
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal title={template ? "Edit Template" : "New Template"} onClose={onClose} width="500px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
            placeholder="e.g., Upper Body Push"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Exercises</label>
          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}>
                <input
                  type="text"
                  value={ex.name}
                  onChange={(e) => updateExercise(i, "name", e.target.value)}
                  className="flex-1 rounded px-2 py-1 text-sm focus:outline-none"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                  placeholder="Exercise name"
                />
                <select
                  value={ex.exercise_type}
                  onChange={(e) => updateExercise(i, "exercise_type", e.target.value)}
                  className="rounded px-2 py-1 text-xs focus:outline-none"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                >
                  <option value="strength">Strength</option>
                  <option value="timed">Timed</option>
                  <option value="cardio">Cardio</option>
                </select>
                {exercises.length > 1 && (
                  <button type="button" onClick={() => removeExercise(i)} className="p-1" style={{ color: "var(--text-muted)" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addExercise}
            className="flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded"
            style={{ color: "var(--accent-primary)" }}
          >
            <Plus className="w-3 h-3" /> Add Exercise
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || exercises.some((ex) => !ex.name.trim()) || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            {isSaving ? "Saving..." : template ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
