"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Paperclip, Globe } from "lucide-react";

interface ComposerMenuProps {
  onAttachFile: () => void;
  webSearchMode: "off" | "basic" | "advanced";
  onToggleWebSearch: () => void;
  disabled?: boolean;
}

export function ComposerMenu({ onAttachFile, webSearchMode, onToggleWebSearch, disabled }: ComposerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const searchLabel = webSearchMode === "off" ? "Off" : webSearchMode === "basic" ? "Basic" : "Deep";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="p-2 rounded-lg transition-colors disabled:opacity-50"
        style={{ color: "var(--text-muted)" }}
        title="More options"
      >
        <Plus className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          <button
            onClick={() => { onAttachFile(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <Paperclip className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            Attach File
          </button>
          <button
            onClick={() => { onToggleWebSearch(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <Globe
              className="w-4 h-4"
              style={{ color: webSearchMode !== "off" ? "var(--accent-primary)" : "var(--text-muted)" }}
            />
            <span>Web Search</span>
            <span
              className="ml-auto text-xs px-1.5 py-0.5 rounded"
              style={{
                background: webSearchMode !== "off" ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: webSearchMode !== "off" ? "var(--bg-base)" : "var(--text-muted)",
              }}
            >
              {searchLabel}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
