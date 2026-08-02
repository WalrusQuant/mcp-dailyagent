"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { useToast } from "@/lib/toast-context";
import { WorkoutTemplate, WorkoutExercise } from "@/types/database";

type TemplateWithExercises = WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };

interface TemplateFormModalProps {
  template?: TemplateWithExercises | null;
  onClose: () => void;
  onSave: (template: TemplateWithExercises) => void;
}

interface ExerciseInput {
  name: string;
  exercise_type: "strength" | "timed" | "cardio";
  default_sets: number;
  default_reps: number;
  default_weight: number;
  default_duration: number;
  notes: string;
}

const emptyExercise = (): ExerciseInput => ({
  name: "",
  exercise_type: "strength",
  default_sets: 3,
  default_reps: 10,
  default_weight: 0,
  default_duration: 60,
  notes: "",
});

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
      notes: e.notes || "",
    })) || [emptyExercise()]
  );
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();
  const id = useId();

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const updateExercise = (index: number, field: string, value: string | number) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
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
          exercises: exercises.map((ex, i) => ({
            name: ex.name.trim(),
            exercise_type: ex.exercise_type,
            default_sets: ex.default_sets,
            default_reps: ex.default_reps,
            default_weight: ex.default_weight,
            default_duration: ex.default_duration,
            notes: ex.notes.trim() || null,
            sort_order: i,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
        return;
      }

      const err = await response.json().catch(() => ({}));
      addToast(err.error || "Failed to save template", "error", 4000);
    } catch (error) {
      console.error("Failed to save template:", error);
      addToast(error instanceof Error ? error.message : "Failed to save template", "error", 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg px-3 py-2 text-sm focus:outline-none";
  const inputStyle = {
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  } as const;

  return (
    <FormModal title={template ? "Edit Template" : "New Template"} onClose={onClose} width="560px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${id}-name`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Name *
          </label>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="e.g., Upper Body Push"
            data-autofocus
          />
        </div>

        <div>
          <label htmlFor={`${id}-description`} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Description
          </label>
          <input
            id={`${id}-description`}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div>
          <div className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Exercises
          </div>
          <div className="space-y-3">
            {exercises.map((ex, i) => (
              <div
                key={i}
                className="rounded-lg p-3 space-y-2"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Exercise ${i + 1} name`}
                    type="text"
                    value={ex.name}
                    onChange={(e) => updateExercise(i, "name", e.target.value)}
                    className="flex-1 rounded px-2 py-1.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                    placeholder="Exercise name"
                  />
                  <select
                    aria-label={`Exercise ${i + 1} type`}
                    value={ex.exercise_type}
                    onChange={(e) => updateExercise(i, "exercise_type", e.target.value)}
                    className="rounded px-2 py-1.5 text-xs focus:outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <option value="strength">Strength</option>
                    <option value="timed">Timed</option>
                    <option value="cardio">Cardio</option>
                  </select>
                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExercise(i)}
                      className="p-1"
                      style={{ color: "var(--text-muted)" }}
                      aria-label="Remove exercise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Defaults by type */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    Sets
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={ex.default_sets}
                      onChange={(e) => updateExercise(i, "default_sets", parseInt(e.target.value) || 1)}
                      className="w-12 rounded px-1.5 py-1 text-center focus:outline-none"
                      style={{
                        background: "var(--bg-surface)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-default)",
                      }}
                    />
                  </label>
                  {ex.exercise_type === "strength" && (
                    <>
                      <label className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        Reps
                        <input
                          type="number"
                          min={0}
                          value={ex.default_reps}
                          onChange={(e) => updateExercise(i, "default_reps", parseInt(e.target.value) || 0)}
                          className="w-12 rounded px-1.5 py-1 text-center focus:outline-none"
                          style={{
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-default)",
                          }}
                        />
                      </label>
                      <label className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        Weight
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={ex.default_weight}
                          onChange={(e) => updateExercise(i, "default_weight", parseFloat(e.target.value) || 0)}
                          className="w-14 rounded px-1.5 py-1 text-center focus:outline-none"
                          style={{
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-default)",
                          }}
                        />
                        <span>lbs</span>
                      </label>
                    </>
                  )}
                  {(ex.exercise_type === "timed" || ex.exercise_type === "cardio") && (
                    <label className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      Duration
                      <input
                        type="number"
                        min={0}
                        value={ex.default_duration}
                        onChange={(e) => updateExercise(i, "default_duration", parseInt(e.target.value) || 0)}
                        className="w-14 rounded px-1.5 py-1 text-center focus:outline-none"
                        style={{
                          background: "var(--bg-surface)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-default)",
                        }}
                      />
                      <span>sec</span>
                    </label>
                  )}
                  {ex.exercise_type === "cardio" && (
                    <label className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      Default reps
                      <input
                        type="number"
                        min={0}
                        value={ex.default_reps}
                        onChange={(e) => updateExercise(i, "default_reps", parseInt(e.target.value) || 0)}
                        className="w-12 rounded px-1.5 py-1 text-center focus:outline-none"
                        style={{
                          background: "var(--bg-surface)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-default)",
                        }}
                      />
                    </label>
                  )}
                </div>

                <input
                  aria-label={`Exercise ${i + 1} notes`}
                  type="text"
                  value={ex.notes}
                  onChange={(e) => updateExercise(i, "notes", e.target.value)}
                  className="w-full rounded px-2 py-1 text-xs focus:outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                  }}
                  placeholder="Notes (optional)"
                />
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
