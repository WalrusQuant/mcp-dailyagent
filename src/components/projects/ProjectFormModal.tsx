"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Project } from "@/types/database";

interface ProjectFormModalProps {
  project?: Project | null;
  onClose: () => void;
  onSave: (project: Project) => void;
}

export function ProjectFormModal({ project, onClose, onSave }: ProjectFormModalProps) {
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status] = useState<"active" | "paused" | "completed">(project?.status || "active");
  const [deadline] = useState(project?.deadline || "");
  const [systemPrompt, setSystemPrompt] = useState(project?.system_prompt || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const method = project ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          deadline: deadline || null,
          system_prompt: systemPrompt.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
      }
    } catch (error) {
      console.error("Failed to save project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative rounded-xl shadow-lg z-10 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", width: "420px", maxWidth: "calc(100vw - 2rem)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {project ? "Edit Project" : "New Project"}
          </h2>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-muted)" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              placeholder="Project name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              rows={3}
              placeholder="What is this project about?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none font-mono"
              style={{
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              rows={4}
              placeholder="Custom instructions for all conversations in this project..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              {isSaving ? "Saving..." : project ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
