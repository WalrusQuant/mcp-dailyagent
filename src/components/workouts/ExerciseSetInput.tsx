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

export function ExerciseSetInput({ exerciseName, exerciseType, sets, onChange, onRemove }: ExerciseSetInputProps) {
  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    onChange([...sets, lastSet ? { ...lastSet } : exerciseType === "timed" ? { duration: 60 } : exerciseType === "strength" ? { reps: 10, weight: 0 } : { reps: 10 }]);
  };

  const updateSet = (index: number, field: string, value: number) => {
    const updated = sets.map((s, i) => i === index ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  const removeSet = (index: number) => {
    onChange(sets.filter((_, i) => i !== index));
  };

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {exerciseName}
        </span>
        <button onClick={onRemove} className="p-1" style={{ color: "var(--text-muted)" }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-6 text-center" style={{ color: "var(--text-muted)" }}>
              {i + 1}
            </span>
            {exerciseType === "timed" ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={set.duration || ""}
                  onChange={(e) => updateSet(i, "duration", parseInt(e.target.value) || 0)}
                  className="w-16 md:w-20 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                  placeholder="sec"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>sec</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={set.reps || ""}
                  onChange={(e) => updateSet(i, "reps", parseInt(e.target.value) || 0)}
                  className="w-14 md:w-16 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                  style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                  placeholder="reps"
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>reps</span>
                {exerciseType === "strength" && (
                  <>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                    <input
                      type="number"
                      value={set.weight || ""}
                      onChange={(e) => updateSet(i, "weight", parseFloat(e.target.value) || 0)}
                      className="w-16 md:w-20 rounded px-2 py-2 md:py-1 text-sm focus:outline-none text-center"
                      style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                      placeholder="lbs"
                    />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>lbs</span>
                  </>
                )}
              </div>
            )}
            {sets.length > 1 && (
              <button onClick={() => removeSet(i)} className="p-0.5" style={{ color: "var(--text-muted)" }}>
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
