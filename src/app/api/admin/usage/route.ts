import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  try {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, monthly_budget")
      .order("email");

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const allUserIds = profiles.map((p) => p.id);

    // Fetch all data in parallel — no N+1
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [limitsResult, convsResult] = await Promise.all([
      supabase
        .from("usage_limits")
        .select("*")
        .eq("active", true),
      supabase
        .from("conversations")
        .select("id, user_id")
        .in("user_id", allUserIds),
    ]);

    const allLimits = limitsResult.data ?? [];
    const allConvs = convsResult.data ?? [];

    // Group conversations by user
    const convsByUser = new Map<string, string[]>();
    for (const conv of allConvs) {
      const list = convsByUser.get(conv.user_id) || [];
      list.push(conv.id);
      convsByUser.set(conv.user_id, list);
    }

    // Get all conversation IDs across all users for message query
    const allConvIds = allConvs.map((c) => c.id);

    // Fetch all assistant messages for current month in batches
    const msgsByConv = new Map<string, { cost: number; tokens: number; count: number }>();

    if (allConvIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < allConvIds.length; i += batchSize) {
        const batch = allConvIds.slice(i, i + batchSize);
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, total_cost, prompt_tokens, completion_tokens")
          .in("conversation_id", batch)
          .eq("role", "assistant")
          .gte("created_at", monthStart);

        for (const msg of msgs ?? []) {
          const existing = msgsByConv.get(msg.conversation_id) || { cost: 0, tokens: 0, count: 0 };
          existing.cost += msg.total_cost || 0;
          existing.tokens += (msg.prompt_tokens || 0) + (msg.completion_tokens || 0);
          existing.count += 1;
          msgsByConv.set(msg.conversation_id, existing);
        }
      }
    }

    // Build per-user aggregates
    const users = profiles.map((profile) => {
      const userConvIds = convsByUser.get(profile.id) || [];
      let currentMonthCost = 0;
      let currentMonthMessages = 0;
      let currentMonthTokens = 0;

      for (const convId of userConvIds) {
        const stats = msgsByConv.get(convId);
        if (stats) {
          currentMonthCost += stats.cost;
          currentMonthMessages += stats.count;
          currentMonthTokens += stats.tokens;
        }
      }

      // Get limits for this user (user-specific + global)
      const userLimits = allLimits.filter(
        (l) => l.user_id === profile.id || l.user_id === null
      );

      // Determine status
      let status: "ok" | "warning" | "exceeded" = "ok";

      if (profile.monthly_budget && currentMonthCost >= profile.monthly_budget) {
        status = "exceeded";
      }

      for (const limit of userLimits) {
        if (limit.limit_type === "cost" && limit.period === "monthly") {
          const pct = (currentMonthCost / Number(limit.limit_value)) * 100;
          if (pct >= 100) {
            status = "exceeded";
          } else if (pct >= 80 && status !== "exceeded") {
            status = "warning";
          }
        }
      }

      if (profile.monthly_budget && status !== "exceeded") {
        const pct = (currentMonthCost / profile.monthly_budget) * 100;
        if (pct >= 80) status = "warning";
      }

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        isAdmin: profile.is_admin,
        monthlyBudget: profile.monthly_budget,
        currentMonthCost,
        currentMonthMessages,
        currentMonthTokens,
        limits: userLimits,
        status,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin usage error:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
