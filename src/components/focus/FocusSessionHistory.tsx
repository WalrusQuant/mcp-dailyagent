"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { FocusSession } from "@/types/database";
import { useToast } from "@/lib/toast-context";

interface FocusSessionHistoryProps {
  sessions: FocusSession[];
  lockedSessionId?: string | null;
  onUpdated: (session: FocusSession) => void;
  onDeleted: (id: string) => void;
}

type HistoricalStatus = Extract<FocusSession["status"], "completed" | "cancelled">;

export function FocusSessionHistory({ sessions, lockedSessionId, onUpdated, onDeleted }: FocusSessionHistoryProps) {
  const { addToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<HistoricalStatus>("completed");
  const [saving, setSaving] = useState(false);

  const beginEdit = (session: FocusSession) => {
    setEditingId(session.id);
    setNotes(session.notes ?? "");
    setStatus(session.status === "cancelled" ? "cancelled" : "completed");
  };

  const save = async (session: FocusSession) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/focus/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || null,
          expected_updated_at: session.updated_at,
          ...(status !== session.status ? { status } : {}),
        }),
      });
      if (!response.ok) {
        addToast(response.status === 409 ? "Session changed elsewhere — reload and try again" : "Failed to update focus session", "error");
        return;
      }
      onUpdated(await response.json());
      setEditingId(null);
      addToast("Focus session updated");
    } catch {
      addToast("Failed to update focus session", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (session: FocusSession) => {
    if (!window.confirm("Delete this focus session?")) return;
    try {
      const response = await fetch(`/api/focus/${session.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      onDeleted(session.id);
      addToast("Focus session deleted");
    } catch {
      addToast("Failed to delete focus session", "error");
    }
  };

  return (
    <ul className="space-y-1.5">
      {sessions.map((session) => (
        <li key={session.id} className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          {editingId === session.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select aria-label="Session status" value={status} onChange={(event) => setStatus(event.target.value as HistoricalStatus)} className="rounded px-2 py-1 text-sm" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
                  {(["completed", "cancelled"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <input aria-label="Session notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="min-w-0 flex-1 rounded px-2 py-1 text-sm" style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }} />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button onClick={() => setEditingId(null)} disabled={saving} style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => save(session)} disabled={saving} className="font-medium" style={{ color: "var(--accent-primary)" }}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span style={{ color: "var(--text-primary)" }}>{session.duration_minutes}m</span>
                <span className="ml-2 text-xs capitalize" style={{ color: "var(--text-muted)" }}>{session.status}</span>
                {session.notes && <span className="ml-2 text-xs" style={{ color: "var(--text-secondary)" }}>{session.notes}</span>}
              </div>
              {session.id !== lockedSessionId && <div className="flex shrink-0">
                <button onClick={() => beginEdit(session)} className="p-2" aria-label="Edit focus session" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(session)} className="p-2" aria-label="Delete focus session" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
