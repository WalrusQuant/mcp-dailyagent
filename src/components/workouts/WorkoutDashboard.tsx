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
import { addDays } from "@/lib/dates";
import { useClientDateContext } from "@/lib/client-date-context";
import { LoadError } from "@/components/shared/LoadError";

type TemplateWithExercises = WorkoutTemplate & { workout_exercises?: WorkoutExercise[] };
type LogWithExercises = WorkoutLog & { workout_log_exercises?: WorkoutLogExercise[] };

type LogFilter = "all" | "7d" | "30d" | "custom";

export function WorkoutDashboard({ initialDate }: { initialDate?: string }) {
  const { today } = useClientDateContext();
  const selectedDate = initialDate && initialDate <= today ? initialDate : today;
  const hasValidInitialDate = initialDate !== undefined && selectedDate === initialDate;
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [logs, setLogs] = useState<LogWithExercises[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithExercises | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<TemplateWithExercises | null | "quick">(null);
  const [editingLog, setEditingLog] = useState<LogWithExercises | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>(() => hasValidInitialDate ? "custom" : "30d");
  const [customFrom, setCustomFrom] = useState(() => hasValidInitialDate ? selectedDate : addDays(today, -29));
  const [customTo, setCustomTo] = useState(() => hasValidInitialDate ? selectedDate : today);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { addToast } = useToast();

  const logsQuery = useCallback(() => {
    if (logFilter === "all") return "/api/workouts/logs";
    if (logFilter === "7d") {
      return `/api/workouts/logs?from=${addDays(today, -6)}&to=${today}`;
    }
    if (logFilter === "30d") {
      return `/api/workouts/logs?from=${addDays(today, -29)}&to=${today}`;
    }
    return `/api/workouts/logs?from=${customFrom}&to=${customTo}`;
  }, [logFilter, customFrom, customTo, today]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const [templatesRes, logsRes] = await Promise.all([
        fetch("/api/workouts/templates", { signal }),
        fetch(logsQuery(), { signal }),
      ]);
      if (!templatesRes.ok || !logsRes.ok) throw new Error("Failed to load workouts");
      const [nextTemplates, nextLogs] = await Promise.all([templatesRes.json(), logsRes.json()]);
      if (signal?.aborted) return;
      setTemplates(nextTemplates);
      setLogs(nextLogs);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load workouts:", error);
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [logsQuery]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, reloadKey]);

  // Re-open an in-progress workout that survived a refresh / PWA kill.
  const restoredDraftRef = useRef(false);
  useEffect(() => {
    if (isLoading || restoredDraftRef.current || editingLog) return;
    restoredDraftRef.current = true;
    const draft = loadWorkoutDraft();
    if (!draft) return;
    if (draft.templateId === null) {
      setActiveWorkout("quick");
    } else {
      const tpl = templates.find((t) => t.id === draft.templateId);
      if (tpl) setActiveWorkout(tpl);
    }
  }, [isLoading, templates, editingLog]);

  const handleDeleteLog = async (log: WorkoutLog) => {
    if (!confirm(`Delete the "${log.name}" workout? This removes its logged exercises and cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/workouts/logs/${log.id}`, { method: "DELETE" });
      if (response.ok) {
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
        addToast("Workout deleted");
      } else {
        addToast("Failed to delete workout", "error");
      }
    } catch (error) {
      console.error("Failed to delete log:", error);
      addToast("Failed to delete workout", "error");
    }
  };

  const handleDeleteTemplate = async (template: TemplateWithExercises) => {
    if (!confirm(`Delete the "${template.name}" template? Workouts already logged from it are kept.`)) {
      return;
    }
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
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ...template } : t)));
    } else {
      setTemplates((prev) => [template, ...prev]);
    }
    addToast(editingTemplate ? "Template updated" : "Template created");
    setShowTemplateForm(false);
    setEditingTemplate(null);
  };

  if (editingLog) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <h2 className="text-sm font-medium mb-4" style={{ color: "var(--text-muted)" }}>
            Edit workout
          </h2>
          <WorkoutLogger
            existingLog={editingLog}
            onSave={() => {
              setEditingLog(null);
              loadData();
            }}
            onCancel={() => setEditingLog(null)}
          />
        </div>
      </div>
    );
  }

  if (activeWorkout) {
    const template = activeWorkout === "quick" ? undefined : activeWorkout;
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <WorkoutLogger
            template={template}
            onSave={() => {
              setActiveWorkout(null);
              loadData();
            }}
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

  if (loadError) {
    return <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto p-4 md:p-6"><LoadError message="Couldn’t load workouts." onRetry={() => setReloadKey((key) => key + 1)} /></div></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Workouts
          </h1>
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
            <h2
              className="text-sm font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Templates
            </h2>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateForm(true);
              }}
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
              onAction={() => {
                setEditingTemplate(null);
                setShowTemplateForm(true);
              }}
            />
          ) : (
            <div className="grid gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="w-full px-4 py-3 rounded-lg flex items-center justify-between gap-2"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {t.name}
                    </span>
                    {t.description && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {t.description}
                      </p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {t.workout_exercises?.length || 0} exercises
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingTemplate(t);
                        setShowTemplateForm(true);
                      }}
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
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h2
              className="text-sm font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              History
            </h2>
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  ["7d", "7 days"],
                  ["30d", "30 days"],
                  ["all", "All"],
                  ["custom", "Custom"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLogFilter(key)}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    background: logFilter === key ? "var(--accent-primary-soft)" : "var(--bg-elevated)",
                    color: logFilter === key ? "var(--accent-primary)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {logFilter === "custom" && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                to
              </span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
            </div>
          )}

          {logs.length === 0 ? (
            <EmptyState icon={Dumbbell} message="No workouts in this range" />
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <WorkoutLogCard
                  key={log.id}
                  log={log}
                  onEdit={setEditingLog}
                  onDelete={handleDeleteLog}
                />
              ))}
            </div>
          )}
        </div>

        {showTemplateForm && (
          <TemplateFormModal
            template={editingTemplate}
            onClose={() => {
              setShowTemplateForm(false);
              setEditingTemplate(null);
            }}
            onSave={handleTemplateSave}
          />
        )}
      </div>
    </div>
  );
}
