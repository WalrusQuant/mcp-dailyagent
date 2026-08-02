"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { JournalEntry } from "@/types/database";
import { useToast } from "@/lib/toast-context";
import {
  clearJournalDraft,
  readJournalDraft,
  writeJournalDraft,
} from "@/lib/journal-drafts";

interface JournalEditorProps {
  entryId?: string;
  initialContent?: string;
  initialMood?: number | null;
  /** ISO timestamp from last known server version (for optimistic concurrency) */
  initialUpdatedAt?: string | null;
  date: string;
  draftOwnerId: string;
  onSave: (entry: JournalEntry) => void;
  onDelete?: () => void;
  /** Called when a 409 conflict requires reloading the entry from the server */
  onConflictReload?: () => void;
}

const MOOD_LABELS = ["Bad", "Meh", "OK", "Good", "Great"];

export function JournalEditor({
  entryId,
  initialContent = "",
  initialMood = null,
  initialUpdatedAt = null,
  date,
  draftOwnerId,
  onSave,
  onDelete,
  onConflictReload,
}: JournalEditorProps) {
  const { addToast } = useToast();
  const [content, setContent] = useState(initialContent);
  const [mood, setMood] = useState<number | null>(initialMood);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef(initialContent);
  const lastSavedMoodRef = useRef(initialMood);

  const entryIdRef = useRef<string | undefined>(entryId);
  useEffect(() => {
    entryIdRef.current = entryId;
  }, [entryId]);

  // Server version for optimistic concurrency (PATCH only)
  const updatedAtRef = useRef<string | null>(initialUpdatedAt);
  useEffect(() => {
    updatedAtRef.current = initialUpdatedAt;
  }, [initialUpdatedAt]);

  const contentRef = useRef(content);
  contentRef.current = content;
  const moodRef = useRef(mood);
  moodRef.current = mood;

  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const draftRevisionRef = useRef<string | null>(null);
  const draftIdentity = `${draftOwnerId}:${date}`;
  const loadedDraftIdentityRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    setDraftReady(false);
    setRecoveredDraft(false);
    setContent(initialContent);
    setMood(initialMood);
    contentRef.current = initialContent;
    moodRef.current = initialMood;
    lastSavedRef.current = initialContent;
    lastSavedMoodRef.current = initialMood;
    entryIdRef.current = entryId;
    updatedAtRef.current = initialUpdatedAt;
    draftRevisionRef.current = null;

    const draft = readJournalDraft(localStorage, draftOwnerId, date);
    if (draft && (draft.content !== initialContent || draft.mood !== initialMood)) {
      setContent(draft.content);
      setMood(draft.mood);
      contentRef.current = draft.content;
      moodRef.current = draft.mood;
      draftRevisionRef.current = draft.revision;
      setRecoveredDraft(true);
    }
    loadedDraftIdentityRef.current = draftIdentity;
    setDraftReady(true);
  }, [draftIdentity, date, draftOwnerId, entryId, initialContent, initialMood, initialUpdatedAt]);

  useEffect(() => {
    if (!draftReady || loadedDraftIdentityRef.current !== draftIdentity) return;
    if (content === lastSavedRef.current && mood === lastSavedMoodRef.current) {
      clearJournalDraft(localStorage, draftOwnerId, date);
      draftRevisionRef.current = null;
      return;
    }
    const draft = writeJournalDraft(localStorage, draftOwnerId, date, content, mood);
    draftRevisionRef.current = draft.revision;
  }, [content, mood, date, draftOwnerId, draftIdentity, draftReady]);

  const save = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    do {
      pendingRef.current = false;
      const text = contentRef.current;
      const moodVal = moodRef.current;
      const draftRevision = draftRevisionRef.current;
      if (!text.trim()) return;

      inFlightRef.current = true;
      setIsSaving(true);
      try {
        const id = entryIdRef.current;
        const url = id ? `/api/journal/${id}` : "/api/journal";
        const body: Record<string, unknown> = {
          content: text,
          mood: moodVal,
          entry_date: date,
        };
        if (id && updatedAtRef.current) {
          body.expected_updated_at = updatedAtRef.current;
        }

        const response = await fetch(url, {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.status === 409) {
          addToast("Entry changed elsewhere — reloading");
          onConflictReload?.();
          pendingRef.current = false;
          break;
        }

        if (response.ok) {
          const data = await response.json();
          if (data.id) entryIdRef.current = data.id;
          if (data.updated_at) updatedAtRef.current = data.updated_at;
          lastSavedRef.current = text;
          lastSavedMoodRef.current = moodVal;
          if (draftRevision) clearJournalDraft(localStorage, draftOwnerId, date, draftRevision);
          if (draftRevisionRef.current === draftRevision) draftRevisionRef.current = null;
          setRecoveredDraft(false);
          onSave(data);
          if (contentRef.current !== lastSavedRef.current) pendingRef.current = true;
        } else {
          let msg = "Failed to save journal entry";
          try {
            const err = await response.json();
            if (err?.error) msg = String(err.error);
          } catch {
            // ignore
          }
          addToast(msg);
        }
      } catch (error) {
        console.error("Failed to save:", error);
        addToast("Failed to save journal entry");
      } finally {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    } while (pendingRef.current);
  }, [date, draftOwnerId, onSave, addToast, onConflictReload]);

  useEffect(() => {
    if (content === lastSavedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(save, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [content, mood, save]);

  const handleMoodChange = (newMood: number) => {
    const val = mood === newMood ? null : newMood;
    setMood(val);
    moodRef.current = val;
    if (content.trim()) save();
  };

  return (
    <div className="space-y-4">
      {recoveredDraft && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--accent-primary-soft)", color: "var(--text-secondary)" }}>
          <span>Recovered an unsaved draft from this device.</span>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => {
              clearJournalDraft(localStorage, draftOwnerId, date);
              draftRevisionRef.current = null;
              setContent(initialContent);
              setMood(initialMood);
              contentRef.current = initialContent;
              moodRef.current = initialMood;
              setRecoveredDraft(false);
            }}
          >
            Discard draft
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Mood:
        </span>
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

      {mood !== null && !content.trim() && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Write something below to save today&apos;s mood.
        </p>
      )}

      <textarea
        aria-label="Journal entry"
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
                if (response.ok) {
                  clearJournalDraft(localStorage, draftOwnerId, date);
                  draftRevisionRef.current = null;
                  onDelete();
                } else {
                  addToast("Failed to delete entry");
                }
              } catch (error) {
                console.error("Failed to delete:", error);
                addToast("Failed to delete entry");
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            className="p-2 rounded-lg text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--text-muted)" }}
            title="Delete entry"
            aria-label="Delete journal entry"
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
