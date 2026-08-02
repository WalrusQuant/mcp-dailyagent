"use client";

import { X } from "lucide-react";
import { useAccessibleDialog } from "@/hooks/useAccessibleDialog";

interface FormModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function FormModal({ title, onClose, children, width = "420px" }: FormModalProps) {
  const { dialogRef, titleId } = useAccessibleDialog(onClose);

  // z-[75] clears the mobile bottom nav (z-[60]) and its More sheet (z-[70]) so
  // the footer buttons stay tappable, while staying under toasts (z-[80]).
  // Insets keep the header out from under the Dynamic Island on notched
  // devices; the panel is then capped to whatever space is left.
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div
        className="fixed inset-0"
        style={{ background: "rgba(15, 17, 21, 0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 max-h-full overflow-y-auto"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-2xl)",
          boxShadow: "var(--shadow-lg)",
          width,
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h2 id={titleId} className="heading-md">{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
