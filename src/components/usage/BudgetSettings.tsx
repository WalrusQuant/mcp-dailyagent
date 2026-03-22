"use client";

import { useState } from "react";
import { DollarSign, X, Loader2 } from "lucide-react";

interface BudgetSettingsProps {
  budget: number | null;
  onBudgetChange: (budget: number | null) => void;
}

export function BudgetSettings({ budget, onBudgetChange }: BudgetSettingsProps) {
  const [value, setValue] = useState(budget?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async (newBudget: number | null) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyBudget: newBudget }),
      });
      if (res.ok) {
        onBudgetChange(newBudget);
      }
    } catch (error) {
      console.error("Failed to save budget:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      save(num);
    }
  };

  const handleClear = () => {
    setValue("");
    save(null);
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Monthly Budget
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Set a monthly spending limit to receive alerts at 80% and 100% usage.
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <DollarSign
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={budget ? budget.toString() : "e.g. 10.00"}
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isSaving || !value}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </button>
        {budget !== null && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Remove budget"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
