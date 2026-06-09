"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef(initialContent);

  // The editor must not remount when the first save assigns an id (that would
  // discard keystrokes typed during the request), so the id lives in a ref
  // that flips POST -> PATCH in place.
  const entryIdRef = useRef<string | undefined>(entryId);
  useEffect(() => {
    if (entryId) entryIdRef.current = entryId;
  }, [entryId]);

  // Latest-value refs so a save always writes what's currently on screen,
  // even when it was queued behind an in-flight request.
  const contentRef = useRef(content);
  contentRef.current = content;
  const moodRef = useRef(mood);
  moodRef.current = mood;

  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  const save = useCallback(async () => {
    // Never run two saves concurrently: a second POST before the first
    // returns would create a duplicate entry for the date. Queue instead.
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    do {
      pendingRef.current = false;
      const text = contentRef.current;
      const moodVal = moodRef.current;
      if (!text.trim()) return;

      inFlightRef.current = true;
      setIsSaving(true);
      try {
        const id = entryIdRef.current;
        const url = id ? `/api/journal/${id}` : "/api/journal";
        const response = await fetch(url, {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, mood: moodVal, entry_date: date }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.id) entryIdRef.current = data.id;
          lastSavedRef.current = text;
          onSave(data);
          // Re-run if more changes arrived while this save was in flight.
          if (contentRef.current !== lastSavedRef.current) pendingRef.current = true;
        }
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    } while (pendingRef.current);
  }, [date, onSave]);

  // Auto-save on content change
  useEffect(() => {
    if (content === lastSavedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(save, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [content, mood, save]);

  const handleMoodChange = (newMood: number) => {
    const val = mood === newMood ? null : newMood;
    setMood(val);
    moodRef.current = val;
    if (content.trim()) save();
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

      <div className="flex items-center justify-end gap-2">
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
          onClick={() => save()}
          disabled={!content.trim() || isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
