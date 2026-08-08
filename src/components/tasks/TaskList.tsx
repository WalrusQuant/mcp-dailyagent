"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckSquare } from "lucide-react";
import { TaskListSkeleton } from "@/components/shared/Skeleton";
import { Task, Space, Goal } from "@/types/database";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { TaskItem } from "./TaskItem";
import { TaskFormModal } from "./TaskFormModal";
import { TaskRolloverBanner } from "./TaskRolloverBanner";
import { useClientDateContext } from "@/lib/client-date-context";
import { useToast } from "@/lib/toast-context";

function useDragReorder(
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  addToast: (message: string) => void,
) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (taskId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (taskId === dragTaskId) return;
    // Reordering only works within a priority group, so don't show a drop
    // indicator (or a "move" cursor) when hovering a different group.
    const src = tasks.find((t) => t.id === dragTaskId);
    const tgt = tasks.find((t) => t.id === taskId);
    if (src && tgt && src.priority[0] !== tgt.priority[0]) {
      e.dataTransfer.dropEffect = "none";
      setDragOverTaskId(null);
      return;
    }
    e.dataTransfer.dropEffect = "move";
    setDragOverTaskId(taskId);
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = (targetTaskId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    setDragOverTaskId(null);
    setDragTaskId(null);

    if (!sourceId || sourceId === targetTaskId) return;

    // Compute the new order outside the updater — React may invoke updaters
    // multiple times in StrictMode, so no side effects belong inside them.
    const prev = tasks;
    const sourceTask = prev.find((t) => t.id === sourceId);
    const targetTask = prev.find((t) => t.id === targetTaskId);
    if (!sourceTask || !targetTask) return;

    // Only reorder within same priority group
    if (sourceTask.priority[0] !== targetTask.priority[0]) return;

    const samePriority = prev.filter((t) => t.priority[0] === sourceTask.priority[0]);
    const others = prev.filter((t) => t.priority[0] !== sourceTask.priority[0]);

    const filtered = samePriority.filter((t) => t.id !== sourceId);
    const targetIdx = filtered.findIndex((t) => t.id === targetTaskId);
    filtered.splice(targetIdx, 0, sourceTask);

    const reordered = filtered.map((t, i) => ({ ...t, sort_order: i }));
    const newTasks = [...others, ...reordered].sort((a, b) => {
      if (a.priority[0] !== b.priority[0]) return a.priority[0].localeCompare(b.priority[0]);
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    // Apply optimistic update
    setTasks(newTasks);

    // Persist — revert to original order on failure
    const payload = reordered.map((t) => ({ id: t.id, sort_order: t.sort_order }));
    try {
      const response = await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      });
      if (!response.ok) {
        setTasks(prev);
        addToast("Failed to save task order");
      }
    } catch {
      setTasks(prev);
      addToast("Failed to save task order");
    }
  };

  const handleDragEnd = () => {
    setDragTaskId(null);
    setDragOverTaskId(null);
  };

  return { dragTaskId, dragOverTaskId, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd };
}

interface PriorityGroup {
  letter: string;
  label: string;
  tasks: Task[];
}

function groupByPriority(tasks: Task[]): PriorityGroup[] {
  const groups: PriorityGroup[] = [
    { letter: "A", label: "Must Do", tasks: [] },
    { letter: "B", label: "Should Do", tasks: [] },
    { letter: "C", label: "Nice to Do", tasks: [] },
  ];

  for (const task of tasks) {
    const letter = task.priority[0];
    const group = groups.find((g) => g.letter === letter);
    if (group) group.tasks.push(task);
  }

  return groups.filter((g) => g.tasks.length > 0);
}

export function taskMatchesView(task: Task, date: string, spaceFilter: string) {
  return task.task_date === date && (!spaceFilter || task.space_id === spaceFilter);
}

export function TaskList({ initialDate }: { initialDate?: string }) {
  const { today } = useClientDateContext();
  const [date, setDate] = useState(() => initialDate && initialDate <= today ? initialDate : today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [spaceFilter, setSpaceFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [prefillTitle, setPrefillTitle] = useState("");
  const [rolloverCount, setRolloverCount] = useState(0);
  const [rolloverDismissed, setRolloverDismissed] = useState(false);

  const isToday = date === today;

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ date });
      if (spaceFilter) params.set("space_id", spaceFilter);
      const response = await fetch(`/api/tasks?${params}`, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`Failed to load tasks (${response.status})`);
      setTasks(await response.json());
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load tasks:", error);
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [date, spaceFilter]);

  useEffect(() => {
    // Abort on date change/unmount so a slow response can't render a stale day.
    const controller = new AbortController();
    loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks]);

  // Surface incomplete past-dated tasks so the user can roll them to today.
  useEffect(() => {
    if (!isToday) {
      setRolloverCount(0);
      return;
    }
    const controller = new AbortController();
    fetch("/api/tasks/rollover/check", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setRolloverCount(d.count ?? 0))
      .catch(() => {});
    return () => controller.abort();
  }, [isToday]);

  useEffect(() => {
    Promise.all([
      fetch("/api/spaces").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/goals?status=all").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([sp, go]) => {
        setSpaces(sp);
        setGoals(go);
      })
      .catch(() => {});
  }, []);

  const spaceNameById = Object.fromEntries(spaces.map((s) => [s.id, s.name]));
  const goalTitleById = Object.fromEntries(goals.map((g) => [g.id, g.title]));

  const handleToggle = async (task: Task) => {
    const newDone = !task.done;
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: newDone } : t));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newDone, expected_updated_at: task.updated_at }),
      });
      if (response.ok) {
        const updated = await response.json();
        setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
        addToast(newDone ? "Task completed" : "Task unchecked");
        return;
      }

      // Revert; on 409 refresh from server `current` so the next toggle uses a
      // fresh version token instead of failing forever until a full reload.
      if (response.status === 409) {
        try {
          const body = await response.json();
          if (body?.current && typeof body.current === "object") {
            setTasks((prev) => prev.map((t) => (t.id === task.id ? body.current : t)));
            addToast("Task was updated elsewhere — try again");
            return;
          }
        } catch {
          // fall through to generic revert
        }
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      addToast("Failed to update task");
    } catch (error) {
      console.error("Failed to toggle task:", error);
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
      addToast("Failed to update task");
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (response.ok) {
        addToast("Task deleted");
      } else {
        // Revert — restore the removed task
        setTasks((prev) => [...prev, task]);
        addToast("Failed to delete task");
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
      setTasks((prev) => [...prev, task]);
      addToast("Failed to delete task");
    }
  };

  const handleSave = (task: Task) => {
    const belongsInView = taskMatchesView(task, date, spaceFilter);
    setTasks((prev) => {
      const withoutSavedTask = prev.filter((item) => item.id !== task.id);
      return belongsInView ? [...withoutSavedTask, task] : withoutSavedTask;
    });
    addToast(editingTask ? "Task updated" : "Task added");
    setShowForm(false);
    setEditingTask(null);
  };

  const handleRollover = async () => {
    try {
      const response = await fetch("/api/tasks/rollover", { method: "POST" });
      if (response.ok) {
        await loadTasks();
        setRolloverCount(0);
        addToast("Past tasks rolled over to today");
      } else {
        addToast("Failed to roll over tasks");
      }
    } catch {
      addToast("Failed to roll over tasks");
    }
  };

  const { addToast } = useToast();
  const drag = useDragReorder(tasks, setTasks, addToast);
  const priorityGroups = groupByPriority(tasks);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Tasks</h1>
          {tasks.length > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {doneCount}/{tasks.length} completed
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {spaces.length > 0 && (
            <select
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="rounded-lg px-2 py-1.5 text-xs focus:outline-none max-w-[140px]"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              aria-label="Filter by space"
            >
              <option value="">All spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <DateNavigation date={date} onDateChange={setDate} />
          <button
            aria-label="Add task"
            onClick={() => {
              setEditingTask(null);
              setPrefillTitle("");
              setShowForm(true);
            }}
            className="p-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isToday && rolloverCount > 0 && !rolloverDismissed && (
        <TaskRolloverBanner
          count={rolloverCount}
          onRollover={handleRollover}
          onDismiss={() => setRolloverDismissed(true)}
        />
      )}

      {isLoading ? (
        <TaskListSkeleton />
      ) : loadError ? (
        <EmptyState
          icon={CheckSquare}
          message="Tasks could not be loaded"
          actionLabel="Retry"
          onAction={() => loadTasks()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          message="No tasks for this day"
          actionLabel="Add Task"
          onAction={() => { setEditingTask(null); setShowForm(true); }}
          suggestions={[
            { label: "Morning routine", data: { title: "Morning routine" } },
            { label: "Weekly planning", data: { title: "Weekly planning" } },
            { label: "Exercise", data: { title: "Exercise" } },
          ]}
          onSuggestionClick={(s) => {
            setEditingTask(null);
            setPrefillTitle((s.data?.title as string) || s.label);
            setShowForm(true);
          }}
        />
      ) : (
        <div className="space-y-6">
          {priorityGroups.map((group) => (
            <div key={group.letter}>
              <div
                className="text-xs uppercase tracking-wider mb-2 px-3 font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    spaceName={task.space_id ? spaceNameById[task.space_id] : null}
                    goalTitle={task.goal_id ? goalTitleById[task.goal_id] : null}
                    onToggle={handleToggle}
                    onEdit={(t) => {
                      setEditingTask(t);
                      setShowForm(true);
                    }}
                    onDelete={handleDelete}
                    isDragging={drag.dragTaskId === task.id}
                    isDragOver={drag.dragOverTaskId === task.id}
                    onDragStart={drag.handleDragStart(task.id)}
                    onDragOver={drag.handleDragOver(task.id)}
                    onDragLeave={drag.handleDragLeave}
                    onDrop={drag.handleDrop(task.id)}
                    onDragEnd={drag.handleDragEnd}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskFormModal
          task={editingTask}
          spaces={spaces}
          defaultDate={date}
          defaultTitle={editingTask ? undefined : prefillTitle}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
            setPrefillTitle("");
          }}
          onSave={handleSave}
        />
      )}
    </div>
    </div>
  );
}
