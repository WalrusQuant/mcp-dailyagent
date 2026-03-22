"use client";

import { useState, useEffect, useRef } from "react";
import { Project } from "@/types/database";

interface ProjectPickerProps {
  conversationId: string;
  currentProjectId: string | null;
  onClose: () => void;
  onProjectChanged: (projectId: string | null) => void;
}

export function ProjectPicker({ conversationId, currentProjectId, onClose, onProjectChanged }: ProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const loadProjects = async () => {
    try {
      const response = await fetch("/api/projects?status=active");
      if (response.ok) setProjects(await response.json());
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectProject = async (projectId: string | null) => {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    onProjectChanged(projectId);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg shadow-lg py-2"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 pb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Move to Project
      </div>
      {isLoading ? (
        <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>Loading...</div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <button
            onClick={() => selectProject(null)}
            className="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style={{
              color: !currentProjectId ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            None
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => selectProject(project.id)}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{
                color: currentProjectId === project.id ? "var(--accent-primary)" : "var(--text-primary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
