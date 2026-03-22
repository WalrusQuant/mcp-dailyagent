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
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg shadow-lg max-w-xs transition-all duration-300"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderLeft: `3px solid ${TYPE_COLORS[type]}`,
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
        {message}
      </span>
      <button
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
    <div className="fixed bottom-20 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
