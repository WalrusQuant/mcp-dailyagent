"use client";

import { useState, useEffect } from "react";
import { Wallet, RefreshCw, AlertTriangle, Globe } from "lucide-react";

interface TavilyUsage {
  used: number;
  limit: number;
  plan: string;
  searchUsed: number;
}

interface UsageData {
  totalCredits: number;
  totalUsage: number;
  balance: number;
  tavily?: TavilyUsage;
}

const LOW_BALANCE_THRESHOLD = 1;

export function UsageBalance() {
  const [mounted, setMounted] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/usage");
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      } else {
        setError("Failed to load");
      }
    } catch {
      setError("Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchUsage();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (!mounted) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{error}</span>
        <button onClick={fetchUsage} className="p-1 transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const isLowBalance = usage && usage.balance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {isLowBalance ? (
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--accent-warning)" }} />
          ) : (
            <Wallet className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          )}
          {isLoading ? (
            <span style={{ color: "var(--text-muted)" }}>Loading...</span>
          ) : usage ? (
            <span style={{ color: isLowBalance ? "var(--accent-warning)" : "var(--accent-positive)" }}>
              {formatCurrency(usage.balance)} balance
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>--</span>
          )}
        </div>
        <button
          onClick={fetchUsage}
          disabled={isLoading}
          className="p-1 transition-colors disabled:opacity-50"
          style={{ color: "var(--text-muted)" }}
          title="Refresh balance"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {usage?.tavily && (
        <div className="flex items-center gap-2 text-xs">
          <Globe className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            {usage.tavily.used > 0 || usage.tavily.limit > 0
              ? `${usage.tavily.used.toLocaleString()}${usage.tavily.limit ? ` / ${usage.tavily.limit.toLocaleString()}` : ""} searches`
              : "Tavily connected"}
          </span>
        </div>
      )}
    </div>
  );
}
