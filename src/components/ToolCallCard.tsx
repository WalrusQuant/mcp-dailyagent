"use client";

import { Check, X, Loader2, ListTodo, BookOpen, Dumbbell, Timer, CheckSquare } from "lucide-react";

interface ToolCallCardProps {
  toolCall: { id: string; name: string; arguments: Record<string, unknown> };
  onApprove: () => void;
  onReject: () => void;
  status: "pending" | "approved" | "rejected" | "executing" | "done";
  result?: { summary: string };
}

const TOOL_ICONS: Record<string, typeof ListTodo> = {
  create_task: ListTodo,
  complete_task: CheckSquare,
  log_habit: Check,
  create_journal_entry: BookOpen,
  start_focus_session: Timer,
};

const TOOL_LABELS: Record<string, string> = {
  create_task: "Create Task",
  complete_task: "Complete Task",
  log_habit: "Log Habit",
  create_journal_entry: "Journal Entry",
  start_focus_session: "Start Focus Session",
};

function formatArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "create_task":
      return `"${args.title}"${args.priority ? ` (${args.priority})` : ""}`;
    case "complete_task":
      return `"${args.task_title}"`;
    case "log_habit":
      return `"${args.habit_name}"${args.date ? ` for ${args.date}` : ""}`;
    case "create_journal_entry":
      return `${String(args.content || "").slice(0, 60)}...`;
    case "start_focus_session":
      return `${args.duration_minutes || 25} min${args.task_title ? ` on "${args.task_title}"` : ""}`;
    default:
      return JSON.stringify(args);
  }
}

export function ToolCallCard({ toolCall, onApprove, onReject, status, result }: ToolCallCardProps) {
  const Icon = TOOL_ICONS[toolCall.name] || Dumbbell;
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  return (
    <div
      className="my-3 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderLeft: "3px solid var(--accent-primary)",
      }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {label}
          </span>
        </div>
        <p className="text-sm ml-6" style={{ color: "var(--text-secondary)" }}>
          {formatArgs(toolCall.name, toolCall.arguments)}
        </p>

        {status === "done" && result && (
          <p className="text-xs mt-2 ml-6" style={{ color: "var(--accent-positive)" }}>
            {result.summary}
          </p>
        )}

        {status === "rejected" && (
          <p className="text-xs mt-2 ml-6" style={{ color: "var(--text-muted)" }}>
            Declined
          </p>
        )}
      </div>

      {status === "pending" && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Check className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}

      {status === "executing" && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--accent-primary)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Executing...</span>
        </div>
      )}
    </div>
  );
}
