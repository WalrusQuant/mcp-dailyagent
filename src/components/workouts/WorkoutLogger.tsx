"use client";

import { useState, useEffect } from "react";
import { Plus, Save, X } from "lucide-react";
import { WorkoutTemplate, WorkoutExercise, WorkoutLog, WorkoutLogExercise } from "@/types/database";
import { ExerciseSetInput } from "./ExerciseSetInput";
import { getToday } from "@/lib/dates";
import { useToast } from "@/lib/toast-context";

interface ExerciseEntry {
  exercise_name: string;
  exercise_type: string;
  sort_order: number;
  sets: Array<{ reps?: number; weight?: number; duration?: number }>;
}

export const WORKOUT_DRAFT_KEY = "cadence:workout-draft";

export interface WorkoutDraft {
  templateId: string | null;
  name: string;
  exercises: ExerciseEntry[];
  startTime: number;
  notes?: string;
  logDate?: string;
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

type LogWithExercises = WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] };

interface WorkoutLoggerProps {
  template?: WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };
  /** When set, logger is in edit mode (PATCH existing log) */
  existingLog?: LogWithExercises | null;
  onSave: () => void;
  onCancel: () => void;
}

function setsFromTemplateExercise(e: WorkoutExercise) {
  const count = e.default_sets || 3;
  return Array.from({ length: count }, () => {
    if (e.exercise_type === "timed") return { duration: e.default_duration || 60 };
    if (e.exercise_type === "cardio") {
      return { reps: e.default_reps || 10, duration: e.default_duration || 60 };
    }
    return { reps: e.default_reps || 10, weight: e.default_weight || 0 };
  });
}

export function WorkoutLogger({ template, existingLog, onSave, onCancel }: WorkoutLoggerProps) {
  const isEdit = !!existingLog;
  const [draft] = useState<WorkoutDraft | null>(() => (isEdit ? null : loadWorkoutDraft()));
  const matchesDraft = !isEdit && !!draft && draft.templateId === (template?.id ?? null);

  const [name, setName] = useState(
    isEdit ? existingLog!.name : matchesDraft ? draft!.name : template?.name || "Quick Workout"
  );
  const [notes, setNotes] = useState(
    isEdit ? existingLog!.notes || "" : matchesDraft ? draft!.notes || "" : ""
  );
  const [logDate, setLogDate] = useState(
    isEdit ? existingLog!.log_date : matchesDraft && draft!.logDate ? draft!.logDate : getToday()
  );
  const [durationMinutes, setDurationMinutes] = useState<number | "">(
    isEdit ? existingLog!.duration_minutes ?? "" : ""
  );
  const [exercises, setExercises] = useState<ExerciseEntry[]>(() => {
    if (isEdit) {
      return (existingLog!.workout_log_exercises || []).map((e, i) => ({
        exercise_name: e.exercise_name,
        exercise_type: e.exercise_type,
        sort_order: e.sort_order ?? i,
        sets: (e.sets || []).map((s) => ({
          reps: s.reps,
          weight: s.weight,
          duration: s.duration,
        })),
      }));
    }
    if (matchesDraft) return draft!.exercises;
    return (
      template?.workout_exercises?.map((e, i) => ({
        exercise_name: e.name,
        exercise_type: e.exercise_type,
        sort_order: i,
        sets: setsFromTemplateExercise(e),
      })) || []
    );
  });
  const [startTime] = useState(matchesDraft ? draft!.startTime : Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseType, setNewExerciseType] = useState("strength");
  const { addToast } = useToast();

  // Persist draft only for new sessions (not edit mode)
  useEffect(() => {
    if (isEdit) return;
    if (exercises.length === 0) {
      clearWorkoutDraft();
      return;
    }
    try {
      window.localStorage.setItem(
        WORKOUT_DRAFT_KEY,
        JSON.stringify({
          templateId: template?.id ?? null,
          name,
          exercises,
          startTime,
          notes,
          logDate,
        } satisfies WorkoutDraft)
      );
    } catch {
      /* ignore */
    }
  }, [name, exercises, startTime, template?.id, notes, logDate, isEdit]);

  const handleCancel = () => {
    if (!isEdit && exercises.length > 0 && !confirm("Discard this workout? Your logged sets will be lost.")) {
      return;
    }
    if (!isEdit) clearWorkoutDraft();
    onCancel();
  };

  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    const type = newExerciseType;
    setExercises((prev) => [
      ...prev,
      {
        exercise_name: newExerciseName.trim(),
        exercise_type: type,
        sort_order: prev.length,
        sets: [
          type === "timed"
            ? { duration: 60 }
            : type === "cardio"
              ? { reps: 10, duration: 60 }
              : { reps: 10, weight: 0 },
        ],
      },
    ]);
    setNewExerciseName("");
  };

  const updateExerciseSets = (
    index: number,
    sets: Array<{ reps?: number; weight?: number; duration?: number }>
  ) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, sets } : e)));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const computedDuration =
        durationMinutes === ""
          ? isEdit
            ? existingLog?.duration_minutes ?? null
            : Math.round((Date.now() - startTime) / 60000)
          : Number(durationMinutes);

      const payload = {
        name: name.trim() || "Workout",
        log_date: logDate,
        duration_minutes: computedDuration,
        notes: notes.trim() || null,
        exercises: exercises.map((ex, i) => ({
          exercise_name: ex.exercise_name,
          exercise_type: ex.exercise_type,
          sort_order: i,
          sets: ex.sets,
        })),
        ...(isEdit
          ? { expected_updated_at: existingLog!.updated_at }
          : { template_id: template?.id || null }),
      };

      const response = await fetch(
        isEdit ? `/api/workouts/logs/${existingLog!.id}` : "/api/workouts/logs",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        if (!isEdit) clearWorkoutDraft();
        addToast(isEdit ? "Workout updated" : "Workout saved");
        onSave();
      } else {
        const err = await response.json().catch(() => ({}));
        addToast(err.error || "Failed to save workout");
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
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-bold bg-transparent focus:outline-none flex-1 min-w-0"
          style={{ color: "var(--text-primary)" }}
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label="Cancel"
          >
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
            {isSaving ? "Saving..." : isEdit ? "Save" : "Finish"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Date
          </label>
          <input
            type="date"
            value={logDate}
            max={getToday()}
            onChange={(e) => setLogDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Duration (min)
          </label>
          <input
            type="number"
            min={0}
            value={durationMinutes}
            onChange={(e) =>
              setDurationMinutes(e.target.value === "" ? "" : parseInt(e.target.value) || 0)
            }
            placeholder={isEdit ? "—" : "auto"}
            className="w-24 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="How did it feel?"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        />
      </div>

      <div className="space-y-3">
        {exercises.length === 0 && (
          <p className="text-sm text-center py-2" style={{ color: "var(--text-muted)" }}>
            Add at least one exercise, then save.
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
          style={{
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
          placeholder="Add exercise..."
        />
        <div className="flex gap-2">
          <select
            value={newExerciseType}
            onChange={(e) => setNewExerciseType(e.target.value)}
            className="flex-1 md:flex-none rounded-lg px-2 py-2.5 md:py-2 text-sm focus:outline-none"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
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
