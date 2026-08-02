export const JOURNAL_DRAFT_VERSION = 1;

export interface JournalDraft {
  version: typeof JOURNAL_DRAFT_VERSION;
  revision: string;
  content: string;
  mood: number | null;
  updatedAt: string;
}

export function journalDraftKey(userId: string, date: string) {
  return `cadence:journal-draft:v${JOURNAL_DRAFT_VERSION}:${userId}:${date}`;
}

export function readJournalDraft(storage: Storage, userId: string, date: string): JournalDraft | null {
  try {
    const value = JSON.parse(storage.getItem(journalDraftKey(userId, date)) || "null");
    if (
      value?.version !== JOURNAL_DRAFT_VERSION ||
      typeof value.revision !== "string" ||
      typeof value.content !== "string" ||
      (value.mood !== null && !Number.isInteger(value.mood)) ||
      typeof value.updatedAt !== "string"
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeJournalDraft(
  storage: Storage,
  userId: string,
  date: string,
  content: string,
  mood: number | null
) {
  const draft: JournalDraft = {
    version: JOURNAL_DRAFT_VERSION,
    revision: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content,
    mood,
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(journalDraftKey(userId, date), JSON.stringify(draft));
  } catch {
    // Storage can be unavailable or full; drafting must never break the editor.
  }
  return draft;
}

export function clearJournalDraft(
  storage: Storage,
  userId: string,
  date: string,
  expectedRevision?: string
) {
  const key = journalDraftKey(userId, date);
  if (expectedRevision) {
    const current = readJournalDraft(storage, userId, date);
    if (current?.revision !== expectedRevision) return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
