"use client";

import { AlertTriangle, AlertCircle } from "lucide-react";

interface BudgetAlertProps {
  alert: "none" | "warning" | "exceeded";
  budget: number;
  spent: number;
  percentUsed: number;
}

export function BudgetAlert({ alert, budget, spent, percentUsed }: BudgetAlertProps) {
  if (alert === "none") return null;

  const isExceeded = alert === "exceeded";
  const Icon = isExceeded ? AlertCircle : AlertTriangle;
  const bgColor = isExceeded ? "rgba(220, 38, 38, 0.1)" : "rgba(234, 179, 8, 0.1)";
  const borderColor = isExceeded ? "rgba(220, 38, 38, 0.3)" : "rgba(234, 179, 8, 0.3)";
  const textColor = isExceeded ? "#dc2626" : "#ca8a04";

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      <Icon className="w-5 h-5 flex-shrink-0" style={{ color: textColor }} />
      <div className="flex-1 text-sm" style={{ color: textColor }}>
        {isExceeded ? (
          <>You&apos;ve exceeded your ${budget.toFixed(2)} monthly budget — spent ${spent.toFixed(2)} ({percentUsed.toFixed(0)}%)</>
        ) : (
          <>You&apos;ve used {percentUsed.toFixed(0)}% of your ${budget.toFixed(2)} monthly budget (${spent.toFixed(2)} spent)</>
        )}
      </div>
    </div>
  );
}
