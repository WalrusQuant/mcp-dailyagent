"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckSquare } from "lucide-react";
import { TaskListSkeleton } from "@/components/shared/Skeleton";
import { Task, Space } from "@/types/database";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { TaskItem } from "./TaskItem";
import { TaskFormModal } from "./TaskFormModal";
import { getToday } from "@/lib/dates";
import { useToast } from "@/lib/toast-context";

function useDragReorder(tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (taskId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (taskId !== dragTaskId) setDragOverTaskId(taskId);
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = (targetTaskId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    setDragOverTaskId(null);
    setDragTaskId(null);

    if (!sourceId || sourceId === targetTaskId) return;

    setTasks((prev) => {
      const sourceTask = prev.find((t) => t.id === sourceId);
      const targetTask = prev.find((t) => t.id === targetTaskId);
      if (!sourceTask || !targetTask) return prev;

      // Only reorder within same priority group
      if (sourceTask.priority[0] !== targetTask.priority[0]) return prev;

      const samePriority = prev.filter((t) => t.priority[0] === sourceTask.priority[0]);
      const others = prev.filter((t) => t.priority[0] !== sourceTask.priority[0]);

      const filtered = samePriority.filter((t) => t.id !== sourceId);
      const targetIdx = filtered.findIndex((t) => t.id === targetTaskId);
      filtered.splice(targetIdx, 0, sourceTask);

      // Assign new sort_orders and persist
      const reordered = filtered.map((t, i) => ({ ...t, sort_order: i }));
      const payload = reordered.map((t) => ({ id: t.id, sort_order: t.sort_order }));
      fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      }).catch(() => {});

      return [...others, ...reordered].sort((a, b) => {
        if (a.priority[0] !== b.priority[0]) return a.priority[0].localeCompare(b.priority[0]);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    });
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

export function TaskList() {
  const [date, setDate] = useState(getToday());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async (d: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tasks?date=${d}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(date);
  }, [date, loadTasks]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then(setSpaces)
      .catch(() => {});
  }, []);

  const handleToggle = async (task: Task) => {
    const newDone = !task.done;
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: newDone }),
      });
      if (response.ok) {
        const updated = await response.json();
        setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
        addToast(newDone ? "Task completed" : "Task unchecked");
      }
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        addToast("Task deleted");
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleSave = (task: Task) => {
    if (editingTask) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    } else {
      setTasks((prev) => [...prev, task]);
    }
    addToast(editingTask ? "Task updated" : "Task added");
    setShowForm(false);
    setEditingTask(null);
  };

  const { addToast } = useToast();
  const drag = useDragReorder(tasks, setTasks);
  const priorityGroups = groupByPriority(tasks);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
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
        <div className="flex items-center gap-3">
          <DateNavigation date={date} onDateChange={setDate} />
          <button
            onClick={() => { setEditingTask(null); setShowForm(true); }}
            className="p-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <TaskListSkeleton />
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
          onSuggestionClick={() => { setEditingTask(null); setShowForm(true); }}
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
                    onToggle={handleToggle}
                    onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
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
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSave={handleSave}
        />
      )}
    </div>
    </div>
  );
}
