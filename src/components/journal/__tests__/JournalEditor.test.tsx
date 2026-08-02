import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { ToastProvider } from "@/lib/toast-context";
import { readJournalDraft, writeJournalDraft } from "@/lib/journal-drafts";

const DATE = "2026-08-01";

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

function renderEditor() {
  return render(
    <ToastProvider>
      <JournalEditor date={DATE} draftOwnerId="user-a" onSave={vi.fn()} />
    </ToastProvider>
  );
}

describe("JournalEditor draft recovery", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", storage);
    vi.restoreAllMocks();
  });

  it("restores and can explicitly discard a per-day draft", async () => {
    writeJournalDraft(localStorage, "user-a", DATE, "Recovered words", 4);
    renderEditor();

    expect(await screen.findByText("Recovered an unsaved draft from this device.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Journal entry" })).toHaveValue("Recovered words");
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.getByRole("textbox", { name: "Journal entry" })).toHaveValue("");
    expect(readJournalDraft(localStorage, "user-a", DATE)).toBeNull();
  });

  it("keeps a newer edit made while an older revision is saving", async () => {
    vi.useFakeTimers();
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderEditor();
    const textarea = screen.getByRole("textbox", { name: "Journal entry" });
    fireEvent.change(textarea, { target: { value: "First revision" } });
    await act(async () => { vi.advanceTimersByTime(2000); });
    fireEvent.change(textarea, { target: { value: "Newer revision" } });
    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ id: "entry", content: "First revision", updated_at: "2026-08-01T12:00:00Z" }), { status: 200 }));
      await Promise.resolve();
    });

    expect(readJournalDraft(localStorage, "user-a", DATE)?.content).toBe("Newer revision");
    vi.useRealTimers();
  });

  it("does not copy content into another date when navigating", () => {
    const view = renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Journal entry" }), {
      target: { value: "August first" },
    });

    view.rerender(
      <ToastProvider>
        <JournalEditor date="2026-08-02" draftOwnerId="user-a" onSave={vi.fn()} />
      </ToastProvider>
    );

    expect(screen.getByRole("textbox", { name: "Journal entry" })).toHaveValue("");
    expect(readJournalDraft(localStorage, "user-a", DATE)?.content).toBe("August first");
    expect(readJournalDraft(localStorage, "user-a", "2026-08-02")).toBeNull();
  });
});
