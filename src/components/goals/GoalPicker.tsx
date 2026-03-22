"use client";

import { useState, useEffect } from "react";
import { Goal } from "@/types/database";

interface GoalPickerProps {
  value: string;
  onChange: (goalId: string) => void;
}

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/goals?status=active");
        if (res.ok) setGoals(await res.json());
      } catch (err) {
        console.error("Failed to load goals:", err);
      }
    };
    load();
  }, []);

  if (goals.length === 0) return null;

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        Goal
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
      >
        <option value="">No goal</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>
    </div>
  );
}
