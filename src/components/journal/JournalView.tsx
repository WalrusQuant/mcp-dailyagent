"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { JournalEntry } from "@/types/database";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { JournalEditor } from "./JournalEditor";
import { JournalEntryCard } from "./JournalEntryCard";
import { getToday } from "@/lib/dates";
import { useToast } from "@/lib/toast-context";

export function JournalView() {
  const [date, setDate] = useState(getToday());
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const { addToast } = useToast();

  const loadData = useCallback(async (d: string) => {
    setIsLoading(true);
    try {
      const [entryRes, recentRes] = await Promise.all([
        fetch(`/api/journal?date=${d}`),
        fetch("/api/journal"),
      ]);

      if (entryRes.ok) {
        const entries: JournalEntry[] = await entryRes.json();
        setTodayEntry(entries.length > 0 ? entries[0] : null);
      }

      if (recentRes.ok) {
        const entries: JournalEntry[] = await recentRes.json();
        setRecentEntries(entries.filter((e) => e.entry_date !== d));
      }
    } catch (error) {
      console.error("Failed to load journal:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/journal?search=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          setSearchResults(await response.json());
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSave = (entry: JournalEntry) => {
    setTodayEntry(entry);
    addToast("Journal saved");
  };

  const handleDelete = () => {
    setTodayEntry(null);
    loadData(date);
    addToast("Entry deleted");
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Journal</h1>
        <DateNavigation date={date} onDateChange={setDate} />
      </div>

      <JournalEditor
        key={`${date}-${todayEntry?.id || "new"}`}
        entryId={todayEntry?.id}
        initialContent={todayEntry?.content || ""}
        initialMood={todayEntry?.mood}
        date={date}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Search */}
      <div className="mt-8 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results or recent */}
      {isSearching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : searchResults ? (
        <div className="space-y-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
          </span>
          {searchResults.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onClick={() => { setDate(entry.entry_date); setSearchQuery(""); }}
            />
          ))}
        </div>
      ) : recentEntries.length > 0 ? (
        <div className="space-y-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Recent Entries</span>
          {recentEntries.slice(0, 10).map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onClick={() => setDate(entry.entry_date)}
            />
          ))}
        </div>
      ) : !todayEntry ? (
        <EmptyState icon={BookOpen} message="Start writing your first entry above" />
      ) : null}
    </div>
    </div>
  );
}
