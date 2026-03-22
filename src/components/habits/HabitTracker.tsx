"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, Loader2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/shared/Skeleton";
import ReactMarkdown from "react-markdown";
import { Habit } from "@/types/database";
import { DateNavigation } from "@/components/shared/DateNavigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { HabitRow } from "./HabitRow";
import { HabitFormModal } from "./HabitFormModal";
import { HabitStats } from "./HabitStats";
import { getToday, startOfWeek, getDateRange, endOfWeek, addDays } from "@/lib/dates";
import { useToast } from "@/lib/toast-context";

interface HabitWithStats {
  habit: Habit;
  logs: Set<string>;
  streak: number;
  completionRate: number;
  recentData: number[];
}

export function HabitTracker() {
  const [date, setDate] = useState(getToday());
  const [habitsWithStats, setHabitsWithStats] = useState<HabitWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [coaching, setCoaching] = useState<string | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);

  const { addToast } = useToast();
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const weekDates = getDateRange(weekStart, weekEnd);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [habitsRes, statsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch("/api/habits/stats?days=30"),
      ]);

      if (!habitsRes.ok) return;
      const habits: Habit[] = await habitsRes.json();

      const statsMap: Record<string, { streak: number; completionRate: number; recentLogs: string[] }> = {};
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        for (const s of statsData.habits) {
          statsMap[s.id] = { streak: s.streak, completionRate: s.completionRate, recentLogs: s.recentLogs };
        }
      }

      const result: HabitWithStats[] = habits.map((habit) => {
        const stats = statsMap[habit.id];
        const logs = new Set<string>(stats?.recentLogs || []);

        // Build sparkline: last 30 days, 1 = logged, 0 = not
        const recentData: number[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = addDays(getToday(), -i);
          recentData.push(logs.has(d) ? 1 : 0);
        }

        return {
          habit,
          logs,
          streak: stats?.streak || 0,
          completionRate: stats?.completionRate || 0,
          recentData,
        };
      });

      setHabitsWithStats(result);
    } catch (error) {
      console.error("Failed to load habits:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (habitId: string, toggleDate: string) => {
    try {
      const response = await fetch(`/api/habits/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: toggleDate }),
      });

      if (response.ok) {
        const { logged } = await response.json();
        addToast(logged ? "Habit logged" : "Habit unlogged");
        setHabitsWithStats((prev) =>
          prev.map((hs) => {
            if (hs.habit.id !== habitId) return hs;
            const newLogs = new Set(hs.logs);
            if (logged) newLogs.add(toggleDate);
            else newLogs.delete(toggleDate);

            // Recalculate sparkline from updated logs
            const recentData: number[] = [];
            for (let i = 29; i >= 0; i--) {
              const d = addDays(getToday(), -i);
              recentData.push(newLogs.has(d) ? 1 : 0);
            }

            // Recalculate streak (consecutive days ending at most recent logged day)
            let streak = 0;
            let started = false;
            for (let i = 0; i <= 29; i++) {
              const d = addDays(getToday(), -i);
              if (newLogs.has(d)) {
                started = true;
                streak++;
              } else if (started) {
                break;
              }
            }

            // Recalculate completion rate (last 30 days)
            const completionRate = Math.round((recentData.filter(Boolean).length / 30) * 100);

            return { ...hs, logs: newLogs, recentData, streak, completionRate };
          })
        );
      }
    } catch (error) {
      console.error("Failed to toggle habit:", error);
    }
  };

  const handleSave = (habit: Habit) => {
    if (editingHabit) {
      setHabitsWithStats((prev) =>
        prev.map((hs) => hs.habit.id === habit.id ? { ...hs, habit } : hs)
      );
    } else {
      setHabitsWithStats((prev) => [
        ...prev,
        { habit, logs: new Set<string>(), streak: 0, completionRate: 0, recentData: new Array(30).fill(0) },
      ]);
    }
    addToast(editingHabit ? "Habit updated" : "Habit added");
    setShowForm(false);
    setEditingHabit(null);
  };

  const handleDelete = async (habit: Habit) => {
    try {
      const response = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
      if (response.ok) {
        setHabitsWithStats((prev) => prev.filter((hs) => hs.habit.id !== habit.id));
        addToast("Habit deleted");
      }
    } catch (error) {
      console.error("Failed to delete habit:", error);
    }
  };

  const loadCoaching = async () => {
    setLoadingCoaching(true);
    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "habit_coaching",
          context: {
            habits: habitsWithStats.map((hs) => ({
              name: hs.habit.name,
              streak: hs.streak,
              completionRate: hs.completionRate,
            })),
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCoaching(data.content);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCoaching(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top,0px)] md:pt-0">
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Habits</h1>
        <div className="flex items-center gap-3">
          <DateNavigation date={date} onDateChange={setDate} mode="week" />
          <button
            onClick={() => { setEditingHabit(null); setShowForm(true); }}
            className="p-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="hidden md:flex items-center gap-3 px-3 mb-2">
        <div className="w-2.5" />
        <div className="w-32" />
        <div className="flex gap-1.5">
          {weekDates.map((d) => (
            <div key={d} className="w-7 text-center text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3)}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton variant="circle" width="10px" height="10px" />
              <Skeleton width="100px" height="14px" />
              <div className="flex gap-1.5 ml-auto">
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} variant="circle" width="28px" height="28px" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : habitsWithStats.length === 0 ? (
        <EmptyState
          icon={Target}
          message="No habits tracked yet"
          actionLabel="Add Habit"
          onAction={() => { setEditingHabit(null); setShowForm(true); }}
          suggestions={[
            { label: "Drink water" },
            { label: "Read 30 min" },
            { label: "Meditate" },
          ]}
          onSuggestionClick={() => { setEditingHabit(null); setShowForm(true); }}
        />
      ) : (
        <div className="space-y-0.5">
          {habitsWithStats.map((hs) => (
            <div key={hs.habit.id}>
              <HabitRow
                habit={hs.habit}
                weekDates={weekDates}
                loggedDates={hs.logs}
                streak={hs.streak}
                completionRate={hs.completionRate}
                recentData={hs.recentData}
                onToggle={handleToggle}
                onNameClick={() => setExpandedHabitId(expandedHabitId === hs.habit.id ? null : hs.habit.id)}
                onEdit={(h) => { setEditingHabit(h); setShowForm(true); }}
                onDelete={handleDelete}
              />
              {expandedHabitId === hs.habit.id && (
                <HabitStats
                  habitName={hs.habit.name}
                  color={hs.habit.color}
                  streak={hs.streak}
                  completionRate={hs.completionRate}
                  loggedDates={hs.logs}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {habitsWithStats.length > 0 && (
        <div className="mt-4">
          <button
            onClick={loadCoaching}
            disabled={loadingCoaching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: "var(--accent-primary)", background: "var(--bg-elevated)" }}
          >
            {loadingCoaching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Coach me
          </button>
          {coaching && (
            <div
              className="mt-3 rounded-lg p-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "var(--accent-primary)" }}>
                  AI Coach
                </span>
                <button onClick={() => setCoaching(null)} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Hide
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-sm" style={{ color: "var(--text-secondary)" }}>
                <ReactMarkdown>{coaching}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <HabitFormModal
          habit={editingHabit}
          onClose={() => { setShowForm(false); setEditingHabit(null); }}
          onSave={handleSave}
        />
      )}
    </div>
    </div>
  );
}
