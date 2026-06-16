"use client";

import { useState, useEffect } from "react";
import { Plus, Save, X } from "lucide-react";
import { WorkoutTemplate, WorkoutExercise } from "@/types/database";
import { ExerciseSetInput } from "./ExerciseSetInput";
import { getToday } from "@/lib/dates";
import { useToast } from "@/lib/toast-context";

interface ExerciseEntry {
  exercise_name: string;
  exercise_type: string;
  sort_order: number;
  sets: Array<{ reps?: number; weight?: number; duration?: number }>;
}

// An in-progress workout is mirrored to localStorage so a refresh, PWA kill,
// or accidental navigation doesn't discard a multi-minute logging session.
export const WORKOUT_DRAFT_KEY = "cadence:workout-draft";

export interface WorkoutDraft {
  templateId: string | null; // null = quick workout
  name: string;
  exercises: ExerciseEntry[];
  startTime: number;
}

export function loadWorkoutDraft(): WorkoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKOUT_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as WorkoutDraft) : null;
  } catch {
    return null;
  }
}

export function clearWorkoutDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKOUT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

interface WorkoutLoggerProps {
  template?: WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };
  onSave: () => void;
  onCancel: () => void;
}

export function WorkoutLogger({ template, onSave, onCancel }: WorkoutLoggerProps) {
  // Restore a saved draft only if it belongs to this workout slot (same
  // template, or both "quick"); otherwise start fresh from the template.
  const [draft] = useState<WorkoutDraft | null>(() => loadWorkoutDraft());
  const matchesDraft = !!draft && draft.templateId === (template?.id ?? null);

  const [name, setName] = useState(matchesDraft ? draft!.name : template?.name || "Quick Workout");
  const [exercises, setExercises] = useState<ExerciseEntry[]>(
    matchesDraft
      ? draft!.exercises
      : template?.workout_exercises?.map((e, i) => ({
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
  const [startTime] = useState(matchesDraft ? draft!.startTime : Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseType, setNewExerciseType] = useState("strength");
  const { addToast } = useToast();

  // Persist the working session as it changes; clear once it has no exercises
  // so an abandoned empty quick-start doesn't get restored later.
  useEffect(() => {
    if (exercises.length === 0) {
      clearWorkoutDraft();
      return;
    }
    try {
      window.localStorage.setItem(
        WORKOUT_DRAFT_KEY,
        JSON.stringify({ templateId: template?.id ?? null, name, exercises, startTime } satisfies WorkoutDraft)
      );
    } catch {
      /* ignore */
    }
  }, [name, exercises, startTime, template?.id]);

  const handleCancel = () => {
    if (exercises.length > 0 && !confirm("Discard this workout? Your logged sets will be lost.")) return;
    clearWorkoutDraft();
    onCancel();
  };

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
        clearWorkoutDraft();
        onSave();
      } else {
        addToast("Failed to save workout");
      }
    } catch (error) {
      console.error("Failed to save workout:", error);
      addToast("Failed to save workout");
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
          <button onClick={handleCancel} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }} aria-label="Cancel workout">
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={exercises.length === 0 || isSaving}
            title={exercises.length === 0 ? "Add at least one exercise first" : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Finish"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.length === 0 && (
          <p className="text-sm text-center py-2" style={{ color: "var(--text-muted)" }}>
            Add at least one exercise, then tap Finish to save.
          </p>
        )}
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
