"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Dumbbell, Play, FileText, Pencil, Trash2 } from "lucide-react";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { WorkoutTemplate, WorkoutExercise, WorkoutLog, WorkoutLogExercise } from "@/types/database";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/lib/toast-context";
import { WorkoutLogCard } from "./WorkoutLogCard";
import { WorkoutLogger, loadWorkoutDraft } from "./WorkoutLogger";
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

  // Re-open an in-progress workout that survived a refresh / PWA kill.
  const restoredDraftRef = useRef(false);
  useEffect(() => {
    if (isLoading || restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    const draft = loadWorkoutDraft();
    if (!draft) return;
    if (draft.templateId === null) {
      setActiveWorkout("quick");
    } else {
      const tpl = templates.find((t) => t.id === draft.templateId);
      if (tpl) setActiveWorkout(tpl);
    }
  }, [isLoading, templates]);

  const handleDeleteLog = async (log: WorkoutLog) => {
    if (!confirm(`Delete the "${log.name}" workout? This removes its logged exercises and cannot be undone.`)) return;
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

  const handleDeleteTemplate = async (template: TemplateWithExercises) => {
    if (!confirm(`Delete the "${template.name}" template? Workouts already logged from it are kept.`)) return;
    const previous = templates;
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    try {
      const response = await fetch(`/api/workouts/templates/${template.id}`, { method: "DELETE" });
      if (response.ok) {
        addToast("Template deleted");
      } else {
        setTemplates(previous);
        addToast("Failed to delete template");
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
      setTemplates(previous);
      addToast("Failed to delete template");
    }
  };

  const handleTemplateSave = (template: TemplateWithExercises) => {
    if (editingTemplate) {
      setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, ...template } : t));
    } else {
      setTemplates((prev) => [template, ...prev]);
    }
    addToast(editingTemplate ? "Template updated" : "Template created");
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  if (activeWorkout) {
    const template = activeWorkout === "quick" ? undefined : activeWorkout;
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <WorkoutLogger
            template={template}
            onSave={() => { setActiveWorkout(null); loadData(); }}
            onCancel={() => setActiveWorkout(null)}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
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
            {/*
              Starting a workout is its own button rather than the whole card:
              when the card itself was the trigger, opening a template to check
              or edit it dropped you straight into the logger, where Finish
              writes a workout you never did.
            */}
            {templates.map((t) => (
              <div
                key={t.id}
                className="w-full px-4 py-3 rounded-lg flex items-center justify-between gap-2"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</span>
                  {t.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {t.workout_exercises?.length || 0} exercises
                  </p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingTemplate(t); setShowTemplateForm(true); }}
                    className="p-2.5 md:p-2 rounded-lg"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t)}
                    className="p-2.5 md:p-2 rounded-lg"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveWorkout(t)}
                    className="flex items-center gap-1.5 ml-1 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                    aria-label={`Start ${t.name}`}
                  >
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                </div>
              </div>
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
