"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Calendar, MessageSquare, FolderKanban } from "lucide-react";
import { Project } from "@/types/database";
import { ProjectFormModal } from "./ProjectFormModal";

interface ProjectWithCount extends Project {
  conversations: [{ count: number }];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "var(--accent-primary)", text: "var(--bg-base)" },
  paused: { bg: "var(--bg-elevated)", text: "var(--text-secondary)" },
  completed: { bg: "var(--accent-positive)", text: "var(--bg-base)" },
};

export function ProjectsList() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const router = useRouter();

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = statusFilter
        ? `/api/projects?status=${statusFilter}`
        : "/api/projects";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectCreated = (project: Project) => {
    setShowModal(false);
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Projects
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-6">
          {[null, "active", "paused", "completed"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: statusFilter === s ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: statusFilter === s ? "var(--bg-base)" : "var(--text-secondary)",
              }}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderKanban className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {statusFilter ? "No projects with this status" : "No projects yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => {
              const convCount = project.conversations?.[0]?.count || 0;
              const statusColor = STATUS_COLORS[project.status] || STATUS_COLORS.active;

              return (
                <button
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="text-left rounded-xl p-4 transition-colors"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                      {project.name}
                    </h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: statusColor.bg, color: statusColor.text }}
                    >
                      {project.status}
                    </span>
                  </div>

                  {project.description && (
                    <p
                      className="text-xs mb-3 line-clamp-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {project.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  {project.progress > 0 && (
                    <div className="mb-3">
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--bg-base)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${project.progress}%`,
                            background: "var(--accent-primary)",
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {project.progress}% complete
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {convCount} chat{convCount !== 1 ? "s" : ""}
                    </span>
                    {project.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ProjectFormModal
          onClose={() => setShowModal(false)}
          onSave={handleProjectCreated}
        />
      )}
    </div>
  );
}
