"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Dumbbell, Play, FileText } from "lucide-react";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { WorkoutTemplate, WorkoutExercise, WorkoutLog, WorkoutLogExercise } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/lib/toast-context";
import { WorkoutLogCard } from "./WorkoutLogCard";
import { WorkoutLogger } from "./WorkoutLogger";
import { TemplateFormModal } from "./TemplateFormModal";
import { WorkoutStats } from "./WorkoutStats";

type TemplateWithExercises = WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };
type LogWithExercises = WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] };

export function WorkoutDashboard() {
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [logs, setLogs] = useState<LogWithExercises[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithExercises | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<TemplateWithExercises | null | "quick">(null);
  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [templatesRes, logsRes] = await Promise.all([
        fetch("/api/workouts/templates"),
        fetch("/api/workouts/logs"),
      ]);

      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error("Failed to load workouts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteLog = async (log: WorkoutLog) => {
    try {
      const response = await fetch(`/api/workouts/logs/${log.id}`, { method: "DELETE" });
      if (response.ok) {
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
        addToast("Workout deleted");
      }
    } catch (error) {
      console.error("Failed to delete log:", error);
    }
  };

  const handleTemplateSave = (template: WorkoutTemplate) => {
    if (editingTemplate) {
      setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, ...template } : t));
    } else {
      setTemplates((prev) => [template as TemplateWithExercises, ...prev]);
    }
    addToast(editingTemplate ? "Template updated" : "Template created");
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  if (activeWorkout) {
    const template = activeWorkout === "quick" ? undefined : activeWorkout;
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <WorkoutLogger
          template={template}
          onSave={() => { setActiveWorkout(null); loadData(); }}
          onCancel={() => setActiveWorkout(null)}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Workouts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveWorkout("quick")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Play className="w-4 h-4" /> Quick Start
          </button>
        </div>
      </div>

      <WorkoutStats />

      {/* Templates */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Templates
          </h2>
          <button
            onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
            style={{ color: "var(--accent-primary)" }}
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            message="No templates yet. Create one to get started faster."
            actionLabel="Create Template"
            onAction={() => { setEditingTemplate(null); setShowTemplateForm(true); }}
          />
        ) : (
          <div className="grid gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveWorkout(t)}
                className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</span>
                  {t.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {t.workout_exercises?.length || 0} exercises
                  </p>
                </div>
                <Play className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Recent Workouts
        </h2>
        {logs.length === 0 ? (
          <EmptyState icon={Dumbbell} message="No workouts logged yet" />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <WorkoutLogCard key={log.id} log={log} onDelete={handleDeleteLog} />
            ))}
          </div>
        )}
      </div>

      {showTemplateForm && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => { setShowTemplateForm(false); setEditingTemplate(null); }}
          onSave={handleTemplateSave}
        />
      )}
    </div>
    </div>
  );
}
