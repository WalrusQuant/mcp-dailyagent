"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface FormModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function FormModal({ title, onClose, children, width = "420px" }: FormModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-xl shadow-lg z-10 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          width,
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
