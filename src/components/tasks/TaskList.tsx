"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckSquare, Loader2, Sparkles } from "lucide-react";
import { TaskListSkeleton } from "@/components/shared/Skeleton";
import { Task, Project } from "@/types/database";
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [breakdownTaskId, setBreakdownTaskId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

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
      .then(setProjects)
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

  const handleBreakdown = async (task: Task) => {
    setBreakdownTaskId(task.id);
    setSubtasks([]);
    setLoadingBreakdown(true);
    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "task_breakdown",
          context: { title: task.title, notes: task.notes, priority: task.priority },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        try {
          const jsonMatch = data.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) setSubtasks(JSON.parse(jsonMatch[0]));
        } catch { /* ignore */ }
      }
    } catch {
      // ignore
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleApproveSubtasks = async () => {
    if (!breakdownTaskId) return;
    const parentTask = tasks.find((t) => t.id === breakdownTaskId);
    const priority = parentTask?.priority || "B1";

    for (const title of subtasks) {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, priority, task_date: date }),
        });
        if (response.ok) {
          const newTask = await response.json();
          setTasks((prev) => [...prev, newTask]);
        }
      } catch { /* continue */ }
    }
    setBreakdownTaskId(null);
    setSubtasks([]);
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
                  <div key={task.id}>
                  <TaskItem
                    task={task}
                    onToggle={handleToggle}
                    onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
                    onDelete={handleDelete}
                    onBreakdown={handleBreakdown}
                    isDragging={drag.dragTaskId === task.id}
                    isDragOver={drag.dragOverTaskId === task.id}
                    onDragStart={drag.handleDragStart(task.id)}
                    onDragOver={drag.handleDragOver(task.id)}
                    onDragLeave={drag.handleDragLeave}
                    onDrop={drag.handleDrop(task.id)}
                    onDragEnd={drag.handleDragEnd}
                  />
                  {breakdownTaskId === task.id && (
                    <div
                      className="ml-8 mt-1 mb-2 rounded-lg p-3"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                    >
                      {loadingBreakdown ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--accent-primary)" }} />
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Breaking down...</span>
                        </div>
                      ) : subtasks.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium" style={{ color: "var(--accent-primary)" }}>
                              <Sparkles className="w-3 h-3 inline mr-1" />Suggested Subtasks
                            </span>
                          </div>
                          <ul className="space-y-1 mb-2">
                            {subtasks.map((st, i) => (
                              <li key={i} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {st}
                              </li>
                            ))}
                          </ul>
                          <div className="flex gap-2">
                            <button
                              onClick={handleApproveSubtasks}
                              className="px-3 py-1 rounded-lg text-xs font-medium"
                              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
                            >
                              Add All
                            </button>
                            <button
                              onClick={() => { setBreakdownTaskId(null); setSubtasks([]); }}
                              className="px-3 py-1 rounded-lg text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>No subtasks generated</span>
                      )}
                    </div>
                  )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskFormModal
          task={editingTask}
          projects={projects}
          defaultDate={date}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSave={handleSave}
        />
      )}
    </div>
    </div>
  );
}
