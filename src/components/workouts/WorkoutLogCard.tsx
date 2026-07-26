"use client";

import { Trash2, Clock, Dumbbell, Pencil } from "lucide-react";
import { WorkoutLog, WorkoutLogExercise } from "@/types/database";
import { formatDate } from "@/lib/dates";

interface WorkoutLogCardProps {
  log: WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] };
  onEdit: (log: WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] }) => void;
  onDelete: (log: WorkoutLog) => void;
}

export function WorkoutLogCard({ log, onEdit, onDelete }: WorkoutLogCardProps) {
  const exercises = log.workout_log_exercises || [];
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {log.name}
          </span>
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
            {formatDate(log.log_date)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onEdit(log)}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label={`Edit ${log.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(log)}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label={`Delete ${log.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
        {log.duration_minutes != null && log.duration_minutes > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {log.duration_minutes} min
          </span>
        )}
        <span className="flex items-center gap-1">
          <Dumbbell className="w-3 h-3" /> {exercises.length} exercises, {totalSets} sets
        </span>
      </div>

      {log.notes && (
        <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
          {log.notes}
        </p>
      )}

      {exercises.length > 0 && (
        <div className="mt-2 space-y-1">
          {exercises.map((ex) => (
            <div key={ex.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {ex.exercise_name}:{" "}
              {ex.sets
                ?.map((s) => {
                  if (ex.exercise_type === "timed" || (s.duration && !s.reps && !s.weight)) {
                    return `${s.duration ?? 0}s`;
                  }
                  if (s.duration && s.reps) return `${s.duration}s / ${s.reps} reps`;
                  if (s.weight) return `${s.reps || 0}×${s.weight}`;
                  return `${s.reps || 0} reps`;
                })
                .join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
