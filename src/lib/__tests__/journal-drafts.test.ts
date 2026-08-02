import { beforeEach, describe, expect, it } from "vitest";
import {
  clearJournalDraft,
  journalDraftKey,
  readJournalDraft,
  writeJournalDraft,
} from "@/lib/journal-drafts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();

describe("journal drafts", () => {
  beforeEach(() => storage.clear());

  it("isolates drafts by user and date", () => {
    writeJournalDraft(storage, "user-a", "2026-08-01", "first", 4);

    expect(readJournalDraft(storage, "user-a", "2026-08-01")?.content).toBe("first");
    expect(readJournalDraft(storage, "user-b", "2026-08-01")).toBeNull();
    expect(readJournalDraft(storage, "user-a", "2026-08-02")).toBeNull();
  });

  it("only clears the revision that was successfully saved", () => {
    const saving = writeJournalDraft(storage, "user-a", "2026-08-01", "first", null);
    const newer = writeJournalDraft(storage, "user-a", "2026-08-01", "second", null);

    expect(clearJournalDraft(storage, "user-a", "2026-08-01", saving.revision)).toBe(false);
    expect(readJournalDraft(storage, "user-a", "2026-08-01")?.revision).toBe(newer.revision);
    expect(clearJournalDraft(storage, "user-a", "2026-08-01", newer.revision)).toBe(true);
    expect(storage.getItem(journalDraftKey("user-a", "2026-08-01"))).toBeNull();
  });

  it("ignores corrupt or unsupported drafts", () => {
    storage.setItem(journalDraftKey("user-a", "2026-08-01"), "not-json");
    expect(readJournalDraft(storage, "user-a", "2026-08-01")).toBeNull();
  });
});
