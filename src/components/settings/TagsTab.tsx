"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Tag } from "@/types/database";
import { useToast } from "@/lib/toast-context";

const PRESET_COLORS = [
  "#8fb5f2",
  "#5ecf8a",
  "#f0a060",
  "#a78bfa",
  "#f07178",
  "#e0b050",
  "#6ba3d6",
  "#94a3b8",
];

export function TagsTab() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tags");
      if (res.ok) setTags(await res.json());
    } catch {
      addToast("Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        const tag = await res.json();
        setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        addToast("Tag created");
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.error || "Failed to create tag");
      }
    } catch {
      addToast("Failed to create tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all tasks.`)) return;
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        addToast("Tag deleted");
      } else {
        addToast("Failed to delete tag");
      }
    } catch {
      addToast("Failed to delete tag");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Tags
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Labels you can attach to tasks for filtering and organization.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        />
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border-2"
              style={{
                background: c,
                borderColor: color === c ? "var(--text-primary)" : "transparent",
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={!name.trim() || isSaving}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No tags yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                {tag.name}
              </span>
              <button
                onClick={() => handleDelete(tag)}
                className="p-1.5 rounded"
                style={{ color: "var(--text-muted)" }}
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
