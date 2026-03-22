"use client";

import { useState, useEffect } from "react";
import { Dumbbell, TrendingUp, Calendar } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";

interface PersonalRecord {
  exercise: string;
  maxWeight: number;
  maxReps: number;
}

interface WorkoutStatsData {
  totalWorkouts: number;
  totalVolume: number;
  weeklyAverage: number;
  personalRecords: PersonalRecord[];
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toLocaleString();
}

export function WorkoutStats() {
  const [stats, setStats] = useState<WorkoutStatsData | null>(null);

  useEffect(() => {
    fetch("/api/workouts/stats?days=30")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats || stats.totalWorkouts === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
        Last 30 Days
      </h2>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard label="Workouts" value={stats.totalWorkouts} icon={Calendar} />
        <StatCard label="Volume" value={`${formatVolume(stats.totalVolume)} lbs`} icon={Dumbbell} />
        <StatCard label="Per Week" value={stats.weeklyAverage} icon={TrendingUp} />
      </div>

      {stats.personalRecords.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Personal Records
          </h3>
          <div className="space-y-1.5">
            {stats.personalRecords.slice(0, 8).map((pr) => (
              <div key={pr.exercise} className="flex items-center justify-between text-sm">
                <span className="capitalize truncate" style={{ color: "var(--text-primary)" }}>
                  {pr.exercise}
                </span>
                <span className="flex-shrink-0 ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {pr.maxWeight > 0 && `${pr.maxWeight} lbs`}
                  {pr.maxWeight > 0 && pr.maxReps > 0 && " / "}
                  {pr.maxReps > 0 && `${pr.maxReps} reps`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
