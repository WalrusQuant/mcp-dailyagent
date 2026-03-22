"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { Tag } from "@/types/database";

interface TagPickerProps {
  conversationId: string;
  onClose: () => void;
}

export function TagPicker({ conversationId, onClose }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsRes, convTagsRes] = await Promise.all([
        fetch("/api/tags"),
        fetch(`/api/conversations/${conversationId}/tags`),
      ]);

      if (tagsRes.ok) setAllTags(await tagsRes.json());
      if (convTagsRes.ok) {
        const convTags: Tag[] = await convTagsRes.json();
        setSelectedIds(new Set(convTags.map((t) => t.id)));
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const toggleTag = async (tagId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedIds(newSelected);

    await fetch(`/api/conversations/${conversationId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: Array.from(newSelected) }),
    });
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      if (response.ok) {
        const tag: Tag = await response.json();
        setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
        setNewTagName("");
        // Auto-select the new tag
        toggleTag(tag.id);
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
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
        Tags
      </div>
      {isLoading ? (
        <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>Loading...</div>
      ) : (
        <>
          <div className="max-h-40 overflow-y-auto">
            {allTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-xs"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="rounded"
                />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: tag.color }}
                />
                {tag.name}
              </label>
            ))}
          </div>
          <div className="px-3 pt-2 mt-1" style={{ borderTop: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTag()}
                placeholder="New tag..."
                className="flex-1 text-xs px-2 py-1 rounded focus:outline-none"
                style={{
                  background: "var(--bg-base)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
              <button
                onClick={createTag}
                disabled={!newTagName.trim()}
                className="p-1 rounded disabled:opacity-30"
                style={{ color: "var(--accent-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
