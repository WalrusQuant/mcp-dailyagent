"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { Space, Task } from "@/types/database";
import { SpaceFormModal } from "./SpaceFormModal";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { useToast } from "@/lib/toast-context";
import { CompletionButton } from "@/components/shared/CompletionButton";

const PRIORITY_COLORS: Record<string, string> = {
  A1: "var(--accent-negative)",
  A2: "var(--accent-negative)",
  A3: "var(--accent-negative)",
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

function taskProgressPercent(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.done).length;
  return Math.round((done / tasks.length) * 100);
}

export function SpaceDashboard({ spaceId }: { spaceId: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [spacesList, setSpacesList] = useState<Space[]>([]);
  const router = useRouter();
  const { addToast } = useToast();

  const autoProgress = useMemo(() => taskProgressPercent(tasks), [tasks]);
  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [spaceRes, tasksRes, spacesRes] = await Promise.all([
        fetch(`/api/spaces/${spaceId}`),
        fetch(`/api/tasks?space_id=${spaceId}`),
        fetch("/api/spaces"),
      ]);

      if (spaceRes.ok) {
        const s = await spaceRes.json();
        setSpace(s);
        setProgress(s.progress ?? 0);
      }
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (spacesRes.ok) setSpacesList(await spacesRes.json());
    } catch (error) {
      console.error("Failed to load space:", error);
      addToast("Failed to load space");
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, addToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateProgress = async (value: number) => {
    const prev = progress;
    setProgress(value);
    try {
      const body: Record<string, unknown> = { progress: value };
      if (space?.updated_at) body.expected_updated_at = space.updated_at;

      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setProgress(prev);
        if (response.status === 409) {
          addToast("Space changed elsewhere — reloading");
          loadAll();
        } else {
          addToast("Failed to update progress");
        }
        return;
      }
      const updated = await response.json();
      setSpace((s) => (s ? { ...s, ...updated } : s));
      setProgress(updated.progress ?? value);
    } catch {
      setProgress(prev);
      addToast("Failed to update progress");
    }
  };

  const syncProgressFromTasks = async () => {
    await updateProgress(autoProgress);
    addToast(`Progress set to ${autoProgress}% from tasks`);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this space? Linked tasks stay but will be unlinked. This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
      if (!res.ok) {
        addToast("Failed to delete space");
        return;
      }
      router.push("/spaces");
    } catch {
      addToast("Failed to delete space");
    }
  };

  const updateStatus = async () => {
    if (!space) return;

    const nextStatus = space.status === "completed" ? "active" : "completed";
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          expected_updated_at: space.updated_at,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          addToast("Space changed elsewhere — reloading", "error");
          await loadAll();
        } else {
          addToast(`Failed to ${nextStatus === "completed" ? "complete" : "reopen"} space`, "error");
        }
        return;
      }

      const updated: Space = await response.json();
      setSpace((current) => (current ? { ...current, ...updated } : current));
      addToast(nextStatus === "completed" ? "Space completed" : "Space reopened");
    } catch {
      addToast(`Failed to ${nextStatus === "completed" ? "complete" : "reopen"} space`, "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const newDone = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: newDone } : t)));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newDone, expected_updated_at: task.updated_at }),
      });
      if (!response.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        addToast("Failed to update task");
        return;
      }
      const updated = await response.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      addToast("Failed to update task");
    }
  };

  const handleTaskSaved = (task: Task) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === task.id);
      if (exists) return prev.map((t) => (t.id === task.id ? task : t));
      return [...prev, task];
    });
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleSpaceSaved = (updated: Space) => {
    setSpace((prev) => (prev ? { ...prev, ...updated } : null));
    setProgress(updated.progress ?? 0);
    setShowEditModal(false);
  };

  const renderTaskRow = (task: Task) => (
    <div
      key={task.id}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
    >
      <button
        onClick={() => handleToggleTask(task)}
        className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: task.done ? "var(--accent-positive)" : "var(--border-default)",
          background: task.done ? "var(--accent-positive)" : "transparent",
        }}
        aria-label={task.done ? "Mark incomplete" : "Mark complete"}
      >
        {task.done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4.5 7.5L8 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditingTask(task);
          setShowTaskModal(true);
        }}
        className="flex-1 text-left text-sm min-w-0"
        style={{
          color: task.done ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: task.done ? "line-through" : "none",
        }}
      >
        <span className="truncate block">{task.title}</span>
      </button>
      <span
        className="text-xs font-medium px-1.5 py-0.5 rounded shrink-0"
        style={{
          color: PRIORITY_COLORS[task.priority] ?? "var(--text-muted)",
          opacity: task.done ? 0.5 : 1,
        }}
      >
        {task.priority}
      </span>
      <button
        onClick={() => {
          setEditingTask(task);
          setShowTaskModal(true);
        }}
        className="p-1.5 rounded shrink-0"
        style={{ color: "var(--text-muted)" }}
        aria-label={`Edit ${task.title}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );

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
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button
            onClick={() => router.push("/spaces")}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Back to spaces"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-[12rem]">
            <div className="flex items-center gap-3 flex-wrap">
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
          <CompletionButton
            entity="space"
            isCompleted={space.status === "completed"}
            isSaving={isUpdatingStatus}
            onClick={updateStatus}
            className="px-3 py-2"
          />
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

        {/* Progress — always shown including 0% */}
        <div
          className="mb-8 rounded-xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Progress
            </label>
            <div className="flex items-center gap-3">
              {tasks.length > 0 && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  From tasks: {autoProgress}%
                </span>
              )}
              <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                {progress}%
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: "var(--bg-base)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--accent-primary)" }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => updateProgress(Number(e.target.value))}
            className="w-full accent-[var(--accent-primary)]"
            aria-label="Space progress"
          />
          <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
            {space.deadline ? (
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Calendar className="w-3 h-3" />
                Deadline:{" "}
                {new Date(space.deadline + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={syncProgressFromTasks}
              disabled={tasks.length === 0}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-40"
              style={{
                background: "var(--accent-primary-soft)",
                color: "var(--accent-primary)",
              }}
              title="Set progress to the percentage of tasks done in this space"
            >
              <RefreshCw className="w-3 h-3" />
              Sync from tasks
            </button>
          </div>
        </div>

        {/* Open tasks */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Open
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                {openTasks.length}
              </span>
            </div>
            <button
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <Plus className="w-3 h-3" />
              Add Task
            </button>
          </div>

          {openTasks.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
              No open tasks. Add one or all tasks are done.
            </p>
          ) : (
            <div className="space-y-1.5">{openTasks.map(renderTaskRow)}</div>
          )}
        </section>

        {/* Done tasks */}
        {doneTasks.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Done
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                {doneTasks.length}
              </span>
            </div>
            <div className="space-y-1.5">{doneTasks.map(renderTaskRow)}</div>
          </section>
        )}
      </div>

      {showEditModal && (
        <SpaceFormModal
          space={space}
          onClose={() => setShowEditModal(false)}
          onSave={handleSpaceSaved}
        />
      )}

      {showTaskModal && (
        <TaskFormModal
          task={editingTask}
          spaces={spacesList}
          defaultSpaceId={spaceId}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={handleTaskSaved}
        />
      )}
    </div>
  );
}
