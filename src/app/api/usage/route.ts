import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/app-config";

let tavilyCache: { data: Record<string, unknown>; ts: number } | null = null;
const TAVILY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch credit balance from OpenRouter
    const openrouterKey = await getConfig("openrouter_api_key");
    if (!openrouterKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch OpenRouter credits");
    }

    const data = await response.json();

    // OpenRouter returns credits in dollars
    // data.data.total_credits - total credits purchased
    // data.data.total_usage - total amount used
    // Balance = total_credits - total_usage

    const result: Record<string, unknown> = {
      totalCredits: data.data?.total_credits ?? 0,
      totalUsage: data.data?.total_usage ?? 0,
      balance: (data.data?.total_credits ?? 0) - (data.data?.total_usage ?? 0),
    };

    // Fetch Tavily usage if API key is configured (cached to avoid rate limits)
    const tavilyKey = await getConfig("tavily_api_key");
    if (tavilyKey) {
      if (tavilyCache && Date.now() - tavilyCache.ts < TAVILY_CACHE_TTL) {
        result.tavily = tavilyCache.data;
      } else {
        try {
          const tavilyRes = await fetch("https://api.tavily.com/usage", {
            headers: {
              Authorization: `Bearer ${tavilyKey}`,
            },
          });
          if (tavilyRes.ok) {
            const tavilyData = await tavilyRes.json();
            const tavily = {
              used: tavilyData.account?.plan_usage ?? 0,
              limit: tavilyData.account?.plan_limit ?? 0,
              plan: tavilyData.account?.current_plan ?? "unknown",
              searchUsed: tavilyData.account?.search_usage ?? 0,
            };
            tavilyCache = { data: tavily, ts: Date.now() };
            result.tavily = tavily;
          } else {
            if (tavilyCache) {
              result.tavily = tavilyCache.data;
            } else {
              result.tavily = { used: 0, limit: 0, plan: "unknown", searchUsed: 0 };
            }
          }
        } catch {
          if (tavilyCache) {
            result.tavily = tavilyCache.data;
          } else {
            result.tavily = { used: 0, limit: 0, plan: "unknown", searchUsed: 0 };
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch OpenRouter credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit data" },
      { status: 500 }
    );
  }
}
