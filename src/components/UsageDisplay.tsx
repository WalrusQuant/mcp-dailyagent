"use client";

import { formatCost, formatTokens } from "@/lib/cost";
import { Coins } from "lucide-react";

interface UsageDisplayProps {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  modelId?: string;
}

export function UsageDisplay({
  promptTokens,
  completionTokens,
  totalCost,
}: UsageDisplayProps) {
  const totalTokens = promptTokens + completionTokens;

  if (totalTokens === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
        <Coins className="w-3 h-3" />
        <span>
          {formatTokens(promptTokens)} in / {formatTokens(completionTokens)} out
        </span>
        {totalCost > 0 && (
          <>
            <span style={{ color: "var(--border-default)" }}>&bull;</span>
            <span>{formatCost(totalCost)}</span>
          </>
        )}
      </div>
    </div>
  );
}
