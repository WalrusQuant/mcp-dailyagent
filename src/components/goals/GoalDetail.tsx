"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, CheckSquare, Target, CalendarDays } from "lucide-react";
import { Goal, Task, Habit, GoalProgressLog } from "@/types/database";
import { SparklineChart } from "@/components/shared/SparklineChart";

interface GoalWithLinked extends Goal {
  tasks: Task[];
  habits: Habit[];
}

interface GoalDetailProps {
  goalId: string;
  onBack: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  health: "#22c55e",
  career: "#3b82f6",
  personal: "#d4a574",
  financial: "#f59e0b",
  learning: "#8b5cf6",
  relationships: "#ec4899",
  other: "#94a3b8",
};

export function GoalDetail({ goalId, onBack }: GoalDetailProps) {
  const [goal, setGoal] = useState<GoalWithLinked | null>(null);
  const [progressLogs, setProgressLogs] = useState<GoalProgressLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [goalRes, progressRes] = await Promise.all([
          fetch(`/api/goals/${goalId}`),
          fetch(`/api/goals/${goalId}/progress`),
        ]);
        if (goalRes.ok) setGoal(await goalRes.json());
        if (progressRes.ok) setProgressLogs(await progressRes.json());
      } catch (err) {
        console.error("Failed to load goal detail:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [goalId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent-primary)" }} />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-12">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Goal not found</p>
      </div>
    );
  }

  const categoryColor = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.other;
  const doneTasks = goal.tasks.filter((t) => t.done).length;
  const progressData = progressLogs.map((l) => l.progress);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm mb-4 transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Goals
      </button>

      <div className="rounded-xl p-5 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase"
            style={{ background: `${categoryColor}20`, color: categoryColor }}
          >
            {goal.category}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase"
            style={{ color: "var(--text-muted)", background: "var(--bg-base)" }}
          >
            {goal.status}
          </span>
        </div>

        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{goal.title}</h2>
        {goal.description && (
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{goal.description}</p>
        )}

        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="w-full h-3 rounded-full" style={{ background: "var(--bg-base)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${goal.progress}%`, background: categoryColor }}
              />
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: categoryColor }}>{goal.progress}%</span>
        </div>

        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
          {goal.target_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Target: {goal.target_date}
            </span>
          )}
          <span className="capitalize">{goal.progress_mode} progress</span>
        </div>
      </div>

      {/* Progress chart */}
      {progressData.length >= 2 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Progress Over Time</h3>
          <SparklineChart data={progressData} color={categoryColor} width={280} height={48} />
        </div>
      )}

      {/* Linked tasks */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Linked Tasks ({doneTasks}/{goal.tasks.length})
          </h3>
        </div>
        {goal.tasks.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tasks linked to this goal</p>
        ) : (
          <div className="space-y-1">
            {goal.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className={t.done ? "line-through opacity-50" : ""}>{t.title}</span>
                <span className="font-bold ml-auto" style={{ color: t.priority[0] === "A" ? "#ef4444" : t.priority[0] === "B" ? "#f59e0b" : "#22c55e" }}>
                  {t.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked habits */}
      <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Linked Habits ({goal.habits.length})
          </h3>
        </div>
        {goal.habits.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No habits linked to this goal</p>
        ) : (
          <div className="space-y-1">
            {goal.habits.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                <span>{h.name}</span>
                <span className="ml-auto capitalize" style={{ color: "var(--text-muted)" }}>{h.frequency}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
