"use client";

import { Trash2, Clock, Dumbbell } from "lucide-react";
import { WorkoutLog, WorkoutLogExercise } from "@/types/database";
import { formatDate } from "@/lib/dates";

interface WorkoutLogCardProps {
  log: WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] };
  onDelete: (log: WorkoutLog) => void;
}

export function WorkoutLogCard({ log, onDelete }: WorkoutLogCardProps) {
  const exercises = log.workout_log_exercises || [];
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);

  return (
    <div
      className="group rounded-lg p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {log.name}
          </span>
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
            {formatDate(log.log_date)}
          </span>
        </div>
        <button
          onClick={() => onDelete(log)}
          className="hidden group-hover:block p-1"
          style={{ color: "var(--text-muted)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
        {log.duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {log.duration_minutes} min
          </span>
        )}
        <span className="flex items-center gap-1">
          <Dumbbell className="w-3 h-3" /> {exercises.length} exercises, {totalSets} sets
        </span>
      </div>

      {exercises.length > 0 && (
        <div className="mt-2 space-y-1">
          {exercises.map((ex) => (
            <div key={ex.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {ex.exercise_name}: {ex.sets?.map((s) => {
                if (s.duration) return `${s.duration}s`;
                if (s.weight) return `${s.reps || 0}×${s.weight}`;
                return `${s.reps || 0} reps`;
              }).join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
