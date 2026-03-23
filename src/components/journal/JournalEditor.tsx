"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { JournalEntry } from "@/types/database";


interface JournalEditorProps {
  entryId?: string;
  initialContent?: string;
  initialMood?: number | null;
  date: string;
  onSave: (entry: JournalEntry) => void;
  onDelete?: () => void;
}

const MOOD_LABELS = ["Bad", "Meh", "OK", "Good", "Great"];

export function JournalEditor({ entryId, initialContent = "", initialMood = null, date, onSave, onDelete }: JournalEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [mood, setMood] = useState<number | null>(initialMood);
  const [isSaving, setIsSaving] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef(initialContent);

  const save = useCallback(async (text: string, moodVal: number | null) => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      const url = entryId ? `/api/journal/${entryId}` : "/api/journal";
      const method = entryId ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, mood: moodVal, entry_date: date }),
      });
      if (response.ok) {
        const data = await response.json();
        lastSavedRef.current = text;
        onSave(data);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [entryId, date, onSave]);

  // Auto-save on content change
  useEffect(() => {
    if (content === lastSavedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => save(content, mood), 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [content, mood, save]);

  const handleMoodChange = (newMood: number) => {
    const val = mood === newMood ? null : newMood;
    setMood(val);
    if (content.trim()) save(content, val);
  };

  const loadPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const response = await fetch("/api/journal/prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPrompts(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Mood:</span>
        {MOOD_LABELS.map((label, i) => {
          const val = i + 1;
          const isSelected = mood === val;
          return (
            <button
              key={val}
              onClick={() => handleMoodChange(val)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                background: isSelected ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: isSelected ? "var(--bg-base)" : "var(--text-muted)",
                opacity: mood === null || isSelected ? 1 : 0.5,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none resize-none min-h-[120px] md:min-h-[200px]"
        style={{
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-default)",
          lineHeight: "1.7",
        }}
        placeholder="Write your thoughts..."
      />

      <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={loadPrompts}
            disabled={loadingPrompts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: "var(--accent-primary)", background: "var(--bg-elevated)" }}
          >
            {loadingPrompts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Get Prompts
          </button>
        </div>
        <div className="flex items-center gap-2 justify-end">
          {isSaving && (
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {entryId && onDelete && (
            <button
              onClick={async () => {
                if (!confirm("Delete this journal entry?")) return;
                setIsDeleting(true);
                try {
                  const response = await fetch(`/api/journal/${entryId}`, { method: "DELETE" });
                  if (response.ok) onDelete();
                } catch (error) {
                  console.error("Failed to delete:", error);
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className="p-2 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: "var(--text-muted)" }}
              title="Delete entry"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => save(content, mood)}
            disabled={!content.trim() || isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            Save
          </button>
        </div>
      </div>

      {prompts.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Prompts:</span>
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => setContent((prev) => prev ? `${prev}\n\n${p}\n` : `${p}\n`)}
              className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
