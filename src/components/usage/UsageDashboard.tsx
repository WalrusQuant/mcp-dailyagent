"use client";

import { useState, useEffect } from "react";
import { Loader2, BarChart3, DollarSign, MessageSquare, Cpu, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { SpendingChart } from "./SpendingChart";
import { ModelBreakdown } from "./ModelBreakdown";
import { TokenChart } from "./TokenChart";
import { BudgetAlert } from "./BudgetAlert";
import { BudgetSettings } from "./BudgetSettings";
import { formatCost, formatTokens } from "@/lib/cost";

type Period = "7d" | "30d" | "90d" | "all";

interface UsageStats {
  summary: {
    totalCost: number;
    totalMessages: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    avgCostPerMessage: number;
  };
  dailyCosts: Array<{
    date: string;
    cost: number;
    messages: number;
    promptTokens: number;
    completionTokens: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    modelName: string;
    cost: number;
    messages: number;
    promptTokens: number;
    completionTokens: number;
  }>;
  budgetStatus: {
    budget: number | null;
    spent: number;
    percentUsed: number;
    alert: "none" | "warning" | "exceeded";
  };
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

export function UsageDashboard() {
  const [data, setData] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/usage/stats?period=${period}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to load usage stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [period]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Failed to load usage data</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Usage Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Track your AI usage and spending
          </p>
        </div>
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border-default)" }}
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: period === p.value ? "var(--accent-primary)" : "var(--bg-surface)",
                color: period === p.value ? "var(--bg-base)" : "var(--text-secondary)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Alert */}
      {data.budgetStatus.alert !== "none" && data.budgetStatus.budget !== null && (
        <BudgetAlert
          alert={data.budgetStatus.alert}
          budget={data.budgetStatus.budget}
          spent={data.budgetStatus.spent}
          percentUsed={data.budgetStatus.percentUsed}
        />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Spend"
          value={formatCost(data.summary.totalCost)}
          icon={DollarSign}
          color="var(--accent-primary)"
        />
        <StatCard
          label="Messages"
          value={data.summary.totalMessages.toLocaleString()}
          icon={MessageSquare}
        />
        <StatCard
          label="Tokens Used"
          value={formatTokens(data.summary.totalPromptTokens + data.summary.totalCompletionTokens)}
          icon={Cpu}
        />
        <StatCard
          label="Avg Cost/Msg"
          value={formatCost(data.summary.avgCostPerMessage)}
          icon={TrendingUp}
        />
      </div>

      {/* Spending Chart */}
      {data.dailyCosts.length > 0 && <SpendingChart data={data.dailyCosts} />}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.modelBreakdown.length > 0 && <ModelBreakdown data={data.modelBreakdown} />}
        {data.dailyCosts.length > 0 && <TokenChart data={data.dailyCosts} />}
      </div>

      {/* Budget Settings */}
      <BudgetSettings
        budget={data.budgetStatus.budget}
        onBudgetChange={(budget) => {
          setData((prev) => prev ? {
            ...prev,
            budgetStatus: {
              ...prev.budgetStatus,
              budget,
              percentUsed: budget ? (prev.budgetStatus.spent / budget) * 100 : 0,
              alert: budget
                ? prev.budgetStatus.spent >= budget ? "exceeded"
                  : prev.budgetStatus.spent >= budget * 0.8 ? "warning"
                  : "none"
                : "none",
            },
          } : null);
        }}
      />
    </div>
  );
}
