"use client";

import { useState, useEffect, useId } from "react";
import { Goal } from "@/types/database";

interface GoalPickerProps {
  value: string;
  onChange: (goalId: string) => void;
}

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const id = useId();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(value ? "/api/goals?status=all" : "/api/goals?status=active");
        if (res.ok) {
          const rows: Goal[] = await res.json();
          setGoals(rows.filter((goal) => goal.status === "active" || goal.id === value));
        }
      } catch (err) {
        console.error("Failed to load goals:", err);
      }
    };
    load();
  }, [value]);

  if (goals.length === 0) {
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          Goal
        </label>
        <select
          id={id}
          disabled
          value=""
          className="w-full rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed"
          style={{ background: "var(--bg-base)", color: "var(--text-muted)", border: "1px solid var(--border-default)" }}
        >
          <option>No goals yet — create one to link tasks</option>
        </select>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        Goal
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
      >
        <option value="">No goal</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id} disabled={g.status !== "active"}>
            {g.title}{g.status !== "active" ? ` (${g.status})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
