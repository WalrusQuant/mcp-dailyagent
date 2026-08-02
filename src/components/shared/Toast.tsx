"use client";

import { useToast } from "@/lib/toast-context";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const TYPE_COLORS = {
  success: "var(--accent-positive)",
  error: "var(--accent-negative)",
  info: "var(--accent-primary)",
};

function ToastItem({
  id,
  message,
  type,
  onRemove,
}: {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  onRemove: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg shadow-lg sm:w-auto sm:max-w-xs transition-all duration-300"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderLeft: `3px solid ${TYPE_COLORS[type]}`,
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <span className="text-sm flex-1 min-w-0 break-words" style={{ color: "var(--text-primary)" }}>
        {message}
      </span>
      <button
        aria-label="Dismiss notification"
        onClick={() => onRemove(id)}
        className="p-0.5 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed left-4 right-4 z-[80] flex flex-col gap-2 sm:left-auto"
      style={{ bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
