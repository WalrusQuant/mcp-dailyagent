"use client";

import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { WorkoutTemplate, WorkoutExercise } from "@/types/database";
import { ExerciseSetInput } from "./ExerciseSetInput";
import { getToday } from "@/lib/dates";

interface ExerciseEntry {
  exercise_name: string;
  exercise_type: string;
  sort_order: number;
  sets: Array<{ reps?: number; weight?: number; duration?: number }>;
}

interface WorkoutLoggerProps {
  template?: WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };
  onSave: () => void;
  onCancel: () => void;
}

export function WorkoutLogger({ template, onSave, onCancel }: WorkoutLoggerProps) {
  const [name, setName] = useState(template?.name || "Quick Workout");
  const [exercises, setExercises] = useState<ExerciseEntry[]>(
    template?.workout_exercises?.map((e, i) => ({
      exercise_name: e.name,
      exercise_type: e.exercise_type,
      sort_order: i,
      sets: Array.from({ length: e.default_sets || 3 }, () =>
        e.exercise_type === "timed"
          ? { duration: e.default_duration || 60 }
          : { reps: e.default_reps || 10, weight: e.default_weight || 0 }
      ),
    })) || []
  );
  const [startTime] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseType, setNewExerciseType] = useState("strength");

  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    setExercises((prev) => [
      ...prev,
      {
        exercise_name: newExerciseName.trim(),
        exercise_type: newExerciseType,
        sort_order: prev.length,
        sets: [newExerciseType === "timed" ? { duration: 60 } : { reps: 10, weight: 0 }],
      },
    ]);
    setNewExerciseName("");
  };

  const updateExerciseSets = (index: number, sets: Array<{ reps?: number; weight?: number; duration?: number }>) => {
    setExercises((prev) => prev.map((e, i) => i === index ? { ...e, sets } : e));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const durationMinutes = Math.round((Date.now() - startTime) / 60000);
      const response = await fetch("/api/workouts/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          template_id: template?.id || null,
          log_date: getToday(),
          duration_minutes: durationMinutes,
          exercises,
        }),
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error("Failed to save workout:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-bold bg-transparent focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={exercises.length === 0 || isSaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Finish"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((ex, i) => (
          <ExerciseSetInput
            key={i}
            exerciseName={ex.exercise_name}
            exerciseType={ex.exercise_type}
            sets={ex.sets}
            onChange={(sets) => updateExerciseSets(i, sets)}
            onRemove={() => removeExercise(i)}
          />
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={newExerciseName}
          onChange={(e) => setNewExerciseName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addExercise()}
          className="flex-1 rounded-lg px-3 py-2.5 md:py-2 text-sm focus:outline-none"
          style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          placeholder="Add exercise..."
        />
        <div className="flex gap-2">
          <select
            value={newExerciseType}
            onChange={(e) => setNewExerciseType(e.target.value)}
            className="flex-1 md:flex-none rounded-lg px-2 py-2.5 md:py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          >
            <option value="strength">Strength</option>
            <option value="timed">Timed</option>
            <option value="cardio">Cardio</option>
          </select>
          <button
            onClick={addExercise}
            disabled={!newExerciseName.trim()}
            className="p-2.5 md:p-2 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
