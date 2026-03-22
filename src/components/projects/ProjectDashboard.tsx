"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Pencil,
} from "lucide-react";
import { Space, Task } from "@/types/database";
import { ProjectFormModal } from "./ProjectFormModal";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";

const PRIORITY_COLORS: Record<string, string> = {
  A1: "var(--accent-negative, #ef4444)",
  A2: "var(--accent-negative, #ef4444)",
  A3: "var(--accent-negative, #ef4444)",
  B1: "var(--accent-primary)",
  B2: "var(--accent-primary)",
  B3: "var(--accent-primary)",
  C1: "var(--text-muted)",
  C2: "var(--text-muted)",
  C3: "var(--text-muted)",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "var(--accent-primary)", text: "var(--bg-base)" },
  paused: { bg: "var(--bg-elevated)", text: "var(--text-secondary)" },
  completed: { bg: "var(--accent-positive)", text: "var(--bg-base)" },
};

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const router = useRouter();

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [spaceRes, tasksRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/tasks?space_id=${projectId}`),
      ]);

      if (spaceRes.ok) {
        const s = await spaceRes.json();
        setSpace(s);
        setProgress(s.progress || 0);
      }
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (error) {
      console.error("Failed to load space:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateProgress = async (value: number) => {
    setProgress(value);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: value }),
    });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this space? This cannot be undone.")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/projects");
  };

  const handleToggleTask = async (task: Task) => {
    const newDone = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: newDone } : t))
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: newDone }),
    });
  };

  const handleTaskSaved = (task: Task) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id);
      if (exists) return prev.map((t) => (t.id === task.id ? task : t));
      return [...prev, task];
    });
    setShowTaskModal(false);
  };

  const handleSpaceSaved = (updated: Space) => {
    setSpace((prev) => (prev ? { ...prev, ...updated } : null));
    setShowEditModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <p style={{ color: "var(--text-muted)" }}>Space not found</p>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[space.status] || STATUS_COLORS.active;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/projects")}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {space.name}
              </h1>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: statusColor.bg, color: statusColor.text }}
              >
                {space.status}
              </span>
            </div>
            {space.description && (
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {space.description}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Edit space"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Delete space"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Progress
            </label>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{progress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => updateProgress(Number(e.target.value))}
            className="w-full accent-[var(--accent-primary)]"
          />
          {space.deadline && (
            <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Calendar className="w-3 h-3" />
              Deadline: {new Date(space.deadline).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Tasks
              </h2>
              {tasks.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                  {tasks.filter((t) => t.done).length}/{tasks.length} done
                </span>
              )}
            </div>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <Plus className="w-3 h-3" />
              Add Task
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
              No tasks linked to this space yet.
            </p>
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ border: "1px solid var(--border-default)" }}
                >
                  <button
                    onClick={() => handleToggleTask(task)}
                    className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: task.done ? "var(--accent-positive, #22c55e)" : "var(--border-default)",
                      background: task.done ? "var(--accent-positive, #22c55e)" : "transparent",
                    }}
                  >
                    {task.done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span
                    className="flex-1 text-sm"
                    style={{
                      color: task.done ? "var(--text-muted)" : "var(--text-primary)",
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    {task.title}
                  </span>
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: PRIORITY_COLORS[task.priority] ?? "var(--text-muted)",
                      opacity: task.done ? 0.5 : 1,
                    }}
                  >
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showEditModal && (
        <ProjectFormModal
          project={space}
          onClose={() => setShowEditModal(false)}
          onSave={handleSpaceSaved}
        />
      )}

      {showTaskModal && (
        <TaskFormModal
          defaultSpaceId={projectId}
          onClose={() => setShowTaskModal(false)}
          onSave={handleTaskSaved}
        />
      )}
    </div>
  );
}
