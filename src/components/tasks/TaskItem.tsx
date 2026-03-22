"use client";

import { useState } from "react";
import { Pencil, Trash2, ChevronDown, ChevronRight, RotateCcw, GripVertical, Sparkles } from "lucide-react";
import { Task } from "@/types/database";

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onBreakdown?: (task: Task) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#22c55e",
};

export function TaskItem({ task, onToggle, onEdit, onDelete, onBreakdown, isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }: TaskItemProps) {
  const [showNotes, setShowNotes] = useState(false);
  const priorityLetter = task.priority[0];
  const color = PRIORITY_COLORS[priorityLetter] || "var(--text-muted)";

  return (
    <div
      className="group flex items-start gap-1 px-1 py-2 rounded-lg transition-colors"
      style={{
        background: task.done ? "var(--bg-base)" : undefined,
        opacity: isDragging ? 0.4 : 1,
        borderTop: isDragOver ? "2px solid var(--accent-primary)" : "2px solid transparent",
      }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={(e) => { if (!task.done) e.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { if (!task.done) e.currentTarget.style.background = ""; }}
    >
      <div className="opacity-40 md:opacity-0 md:group-hover:opacity-100 cursor-grab pt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
        <GripVertical className="w-4 h-4" />
      </div>
      <button
        onClick={() => onToggle(task)}
        className="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: task.done ? "var(--text-muted)" : color,
          background: task.done ? "var(--text-muted)" : "transparent",
        }}
      >
        {task.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${color}20`, color }}
          >
            {task.priority}
          </span>
          <span
            className={`text-sm flex-1 truncate ${task.done ? "line-through" : ""}`}
            style={{ color: task.done ? "var(--text-muted)" : "var(--text-primary)" }}
          >
            {task.title}
          </span>
          {task.rolled_from && (
            <span title="Rolled over"><RotateCcw className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} /></span>
          )}
        </div>

        {task.notes && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 mt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {showNotes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Notes
          </button>
        )}
        {showNotes && task.notes && (
          <p className="text-xs mt-1 pl-4" style={{ color: "var(--text-secondary)" }}>
            {task.notes}
          </p>
        )}
      </div>

      <div className="flex md:hidden md:group-hover:flex items-center gap-0 shrink-0">
        {onBreakdown && !task.done && (
          <button onClick={() => onBreakdown(task)} className="p-2 md:p-1" style={{ color: "var(--accent-primary)" }} title="Break down">
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onEdit(task)} className="p-2 md:p-1" style={{ color: "var(--text-muted)" }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(task)} className="p-2 md:p-1" style={{ color: "var(--text-muted)" }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
