"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Crosshair } from "lucide-react";
import { Goal } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { GoalItem } from "./GoalItem";
import { GoalFormModal } from "./GoalFormModal";
import { GoalDetail } from "./GoalDetail";

type StatusTab = "active" | "completed" | "abandoned";

export function GoalList() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const loadGoals = useCallback(async (status: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/goals?status=${status}`);
      if (res.ok) setGoals(await res.json());
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals(statusTab);
  }, [statusTab, loadGoals]);

  const handleSave = (goal: Goal) => {
    if (editingGoal) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
    } else {
      setGoals((prev) => [goal, ...prev]);
    }
    setShowForm(false);
    setEditingGoal(null);
  };

  const handleDelete = async (goal: Goal) => {
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  if (selectedGoalId) {
    return (
      <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <GoalDetail goalId={selectedGoalId} onBack={() => setSelectedGoalId(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Goals</h1>
          <button
            onClick={() => { setEditingGoal(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
            New Goal
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--bg-base)" }}>
          {(["active", "completed", "abandoned"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize"
              style={{
                background: statusTab === tab ? "var(--bg-surface)" : "transparent",
                color: statusTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent-primary)" }} />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Crosshair}
            message={statusTab === "active" ? "No active goals. Set a goal and start tracking your progress." : `No ${statusTab} goals`}
          />
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onEdit={(g) => { setEditingGoal(g); setShowForm(true); }}
                onDelete={handleDelete}
                onClick={(g) => setSelectedGoalId(g.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <GoalFormModal
          goal={editingGoal}
          onClose={() => { setShowForm(false); setEditingGoal(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
