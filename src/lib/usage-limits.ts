import { createClient } from "@/lib/supabase/server";

export interface UsageLimitCheck {
  blocked: boolean;
  warning: boolean;
  reason?: string;
}

interface CachedResult {
  result: UsageLimitCheck;
  checkedAt: number;
}

const cache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function checkUsageLimits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  isAdmin: boolean
): Promise<UsageLimitCheck> {
  if (isAdmin) return { blocked: false, warning: false };

  // Check cache — only return cached if not blocked/warning
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    if (!cached.result.blocked && !cached.result.warning) {
      return cached.result;
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Fetch in parallel
  const [profileResult, limitsResult, convsResult] = await Promise.all([
    supabase.from("profiles").select("monthly_budget").eq("id", userId).single(),
    supabase
      .from("usage_limits")
      .select("*")
      .eq("active", true)
      .or(`user_id.eq.${userId},user_id.is.null`),
    supabase.from("conversations").select("id").eq("user_id", userId),
  ]);

  const monthlyBudget = profileResult.data?.monthly_budget ?? null;
  const limits = limitsResult.data ?? [];
  const convIds = (convsResult.data ?? []).map((c) => c.id);

  if (convIds.length === 0 && limits.length === 0 && !monthlyBudget) {
    const result: UsageLimitCheck = { blocked: false, warning: false };
    cache.set(userId, { result, checkedAt: Date.now() });
    return result;
  }

  // Query usage for current month and day (assistant messages only)
  let monthCost = 0;
  let monthTokens = 0;
  let dayCost = 0;
  let dayTokens = 0;

  if (convIds.length > 0) {
    // Supabase .in() has a practical limit, batch if needed
    const batchSize = 100;
    for (let i = 0; i < convIds.length; i += batchSize) {
      const batch = convIds.slice(i, i + batchSize);

      const [monthResult, dayResult] = await Promise.all([
        supabase
          .from("messages")
          .select("total_cost, prompt_tokens, completion_tokens")
          .in("conversation_id", batch)
          .eq("role", "assistant")
          .gte("created_at", monthStart),
        supabase
          .from("messages")
          .select("total_cost, prompt_tokens, completion_tokens")
          .in("conversation_id", batch)
          .eq("role", "assistant")
          .gte("created_at", dayStart),
      ]);

      for (const msg of monthResult.data ?? []) {
        monthCost += msg.total_cost || 0;
        monthTokens += (msg.prompt_tokens || 0) + (msg.completion_tokens || 0);
      }
      for (const msg of dayResult.data ?? []) {
        dayCost += msg.total_cost || 0;
        dayTokens += (msg.prompt_tokens || 0) + (msg.completion_tokens || 0);
      }
    }
  }

  // Check monthly_budget first
  if (monthlyBudget && monthCost >= monthlyBudget) {
    const result: UsageLimitCheck = {
      blocked: true,
      warning: false,
      reason: `Monthly budget of $${monthlyBudget.toFixed(2)} exceeded (spent: $${monthCost.toFixed(2)})`,
    };
    cache.set(userId, { result, checkedAt: Date.now() });
    return result;
  }

  // Resolve limits: user-specific overrides global for same type+period
  const resolved = new Map<string, typeof limits[0]>();
  for (const limit of limits) {
    const key = `${limit.limit_type}:${limit.period}`;
    const existing = resolved.get(key);
    // User-specific (non-null user_id) takes priority over global
    if (!existing || (limit.user_id && !existing.user_id)) {
      resolved.set(key, limit);
    }
  }

  let worstResult: UsageLimitCheck = { blocked: false, warning: false };

  for (const [, limit] of resolved) {
    const actual =
      limit.limit_type === "cost"
        ? limit.period === "monthly"
          ? monthCost
          : dayCost
        : limit.period === "monthly"
          ? monthTokens
          : dayTokens;

    const limitValue = Number(limit.limit_value);
    const unit = limit.limit_type === "cost" ? "$" : " tokens";
    const periodLabel = limit.period;

    if (actual >= limitValue) {
      if (limit.mode === "hard") {
        const result: UsageLimitCheck = {
          blocked: true,
          warning: false,
          reason: `${periodLabel} ${limit.limit_type} limit of ${unit === "$" ? "$" : ""}${limitValue}${unit === "$" ? "" : unit} exceeded`,
        };
        cache.set(userId, { result, checkedAt: Date.now() });
        return result;
      } else {
        worstResult = {
          blocked: false,
          warning: true,
          reason: `${periodLabel} ${limit.limit_type} limit of ${unit === "$" ? "$" : ""}${limitValue}${unit === "$" ? "" : unit} exceeded (soft limit)`,
        };
      }
    }
  }

  cache.set(userId, { result: worstResult, checkedAt: Date.now() });
  return worstResult;
}

export function usageLimitResponse(reason: string): Response {
  return new Response(
    JSON.stringify({ error: "Usage limit exceeded", reason }),
    {
      status: 402,
      headers: { "Content-Type": "application/json" },
    }
  );
}
