"use client";

import { Plus, Trash2 } from "lucide-react";

interface SetData {
  reps?: number;
  weight?: number;
  duration?: number;
}

interface ExerciseSetInputProps {
  exerciseName: string;
  exerciseType: string;
  sets: SetData[];
  onChange: (sets: SetData[]) => void;
  onRemove: () => void;
}

function defaultSet(exerciseType: string): SetData {
  if (exerciseType === "timed") return { duration: 60 };
  if (exerciseType === "cardio") return { reps: 10, duration: 60 };
  return { reps: 10, weight: 0 };
}

export function ExerciseSetInput({ exerciseName, exerciseType, sets, onChange, onRemove }: ExerciseSetInputProps) {
  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    onChange([...sets, lastSet ? { ...lastSet } : defaultSet(exerciseType)]);
  };

  const updateSet = (index: number, field: string, value: number) => {
    const updated = sets.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(updated);
  };

  const removeSet = (index: number) => {
    onChange(sets.filter((_, i) => i !== index));
  };

  const fieldStyle = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  } as const;

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {exerciseName}
          <span className="ml-1.5 text-[10px] font-normal uppercase" style={{ color: "var(--text-muted)" }}>
            {exerciseType}
          </span>
        </span>
        <button onClick={onRemove} className="p-1" style={{ color: "var(--text-muted)" }} aria-label="Remove exercise">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs w-6 text-center" style={{ color: "var(--text-muted)" }}>
              {i + 1}
            </span>

            {exerciseType === "timed" && (
              <div className="flex items-center gap-1 flex-1">
                <input
                  aria-label={`${exerciseName} set ${i + 1} duration in seconds`}
                  type="number"
                  value={set.duration ?? ""}
                  onChange={(e) => updateSet(i, "duration", parseInt(e.target.value) || 0)}
                  className="w-16 md:w-20 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={fieldStyle}
                  placeholder="sec"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  sec
                </span>
              </div>
            )}

            {exerciseType === "strength" && (
              <div className="flex items-center gap-1 flex-1">
                <input
                  aria-label={`${exerciseName} set ${i + 1} repetitions`}
                  type="number"
                  value={set.reps ?? ""}
                  onChange={(e) => updateSet(i, "reps", parseInt(e.target.value) || 0)}
                  className="w-14 md:w-16 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={fieldStyle}
                  placeholder="reps"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  reps
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ×
                </span>
                <input
                  aria-label={`${exerciseName} set ${i + 1} weight in pounds`}
                  type="number"
                  value={set.weight ?? ""}
                  onChange={(e) => updateSet(i, "weight", parseFloat(e.target.value) || 0)}
                  className="w-16 md:w-20 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={fieldStyle}
                  placeholder="lbs"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  lbs
                </span>
              </div>
            )}

            {exerciseType === "cardio" && (
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                <input
                  aria-label={`${exerciseName} set ${i + 1} duration in seconds`}
                  type="number"
                  value={set.duration ?? ""}
                  onChange={(e) => updateSet(i, "duration", parseInt(e.target.value) || 0)}
                  className="w-16 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={fieldStyle}
                  placeholder="sec"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  sec
                </span>
                <input
                  aria-label={`${exerciseName} set ${i + 1} repetitions`}
                  type="number"
                  value={set.reps ?? ""}
                  onChange={(e) => updateSet(i, "reps", parseInt(e.target.value) || 0)}
                  className="w-14 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={fieldStyle}
                  placeholder="reps"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  reps
                </span>
              </div>
            )}

            {sets.length > 1 && (
              <button onClick={() => removeSet(i)} className="p-0.5" style={{ color: "var(--text-muted)" }} aria-label="Remove set">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addSet}
        className="flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded"
        style={{ color: "var(--accent-primary)" }}
      >
        <Plus className="w-3 h-3" /> Add Set
      </button>
    </div>
  );
}
