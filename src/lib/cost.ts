export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  pricing?: { prompt: number; completion: number }
): number {
  if (!pricing) return 0;

  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;

  return promptCost + completionCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}
