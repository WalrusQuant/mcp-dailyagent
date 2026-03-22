import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "30d";
  const groupBy = searchParams.get("groupBy") || "day";

  // Calculate date cutoff
  const now = new Date();
  let cutoff: Date | null = null;
  if (period === "7d") cutoff = new Date(now.getTime() - 7 * 86400000);
  else if (period === "30d") cutoff = new Date(now.getTime() - 30 * 86400000);
  else if (period === "90d") cutoff = new Date(now.getTime() - 90 * 86400000);
  // "all" = no cutoff

  try {
    // Get user's conversation IDs
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, model")
      .eq("user_id", user.id);

    if (!convs || convs.length === 0) {
      return NextResponse.json({
        summary: { totalCost: 0, totalMessages: 0, totalPromptTokens: 0, totalCompletionTokens: 0, avgCostPerMessage: 0 },
        dailyCosts: [],
        modelBreakdown: [],
        budgetStatus: { budget: null, spent: 0, percentUsed: 0, alert: "none" },
      });
    }

    const convIds = convs.map((c) => c.id);
    const convModelMap = new Map(convs.map((c) => [c.id, c.model]));

    // Fetch messages with cost data
    let query = supabase
      .from("messages")
      .select("id, conversation_id, role, prompt_tokens, completion_tokens, total_cost, created_at")
      .in("conversation_id", convIds)
      .eq("role", "assistant");

    if (cutoff) {
      query = query.gte("created_at", cutoff.toISOString());
    }

    const { data: messages, error } = await query.order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get model display names
    const { data: appModels } = await supabase
      .from("app_models")
      .select("model_id, name");

    const modelNameMap = new Map(
      (appModels || []).map((m) => [m.model_id, m.name])
    );

    // Calculate summary
    let totalCost = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const totalMessages = messages?.length || 0;

    // Group by date and model
    const dailyMap = new Map<string, { cost: number; messages: number; promptTokens: number; completionTokens: number }>();
    const modelMap = new Map<string, { cost: number; messages: number; promptTokens: number; completionTokens: number }>();

    for (const msg of messages || []) {
      const cost = msg.total_cost || 0;
      const prompt = msg.prompt_tokens || 0;
      const completion = msg.completion_tokens || 0;

      totalCost += cost;
      totalPromptTokens += prompt;
      totalCompletionTokens += completion;

      // Group by date
      const dateKey = formatDateKey(msg.created_at, groupBy);
      const existing = dailyMap.get(dateKey) || { cost: 0, messages: 0, promptTokens: 0, completionTokens: 0 };
      existing.cost += cost;
      existing.messages += 1;
      existing.promptTokens += prompt;
      existing.completionTokens += completion;
      dailyMap.set(dateKey, existing);

      // Group by model
      const modelId = convModelMap.get(msg.conversation_id) || "unknown";
      const modelData = modelMap.get(modelId) || { cost: 0, messages: 0, promptTokens: 0, completionTokens: 0 };
      modelData.cost += cost;
      modelData.messages += 1;
      modelData.promptTokens += prompt;
      modelData.completionTokens += completion;
      modelMap.set(modelId, modelData);
    }

    const dailyCosts = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, cost: data.cost, messages: data.messages, promptTokens: data.promptTokens, completionTokens: data.completionTokens }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const modelBreakdown = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        modelName: modelNameMap.get(model) || model.split("/").pop() || model,
        cost: data.cost,
        messages: data.messages,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
      }))
      .sort((a, b) => b.cost - a.cost);

    // Budget status (current month)
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_budget")
      .eq("id", user.id)
      .single();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthSpent = 0;
    for (const msg of messages || []) {
      if (new Date(msg.created_at) >= monthStart) {
        monthSpent += msg.total_cost || 0;
      }
    }

    // If period doesn't cover full month, do a separate query for budget
    if (cutoff && cutoff > monthStart) {
      const { data: monthMessages } = await supabase
        .from("messages")
        .select("total_cost")
        .in("conversation_id", convIds)
        .eq("role", "assistant")
        .gte("created_at", monthStart.toISOString());

      monthSpent = (monthMessages || []).reduce((sum, m) => sum + (m.total_cost || 0), 0);
    }

    const budget = profile?.monthly_budget ?? null;
    const percentUsed = budget ? (monthSpent / budget) * 100 : 0;
    let alert: "none" | "warning" | "exceeded" = "none";
    if (budget) {
      if (percentUsed >= 100) alert = "exceeded";
      else if (percentUsed >= 80) alert = "warning";
    }

    return NextResponse.json({
      summary: {
        totalCost,
        totalMessages,
        totalPromptTokens,
        totalCompletionTokens,
        avgCostPerMessage: totalMessages > 0 ? totalCost / totalMessages : 0,
      },
      dailyCosts,
      modelBreakdown,
      budgetStatus: { budget, spent: monthSpent, percentUsed, alert },
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}

function formatDateKey(dateStr: string, groupBy: string): string {
  const date = new Date(dateStr);
  if (groupBy === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (groupBy === "week") {
    // ISO week start (Monday)
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
}
