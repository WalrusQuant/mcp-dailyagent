import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  try {
    // Fetch all profiles with basic stats
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, plan, subscription_status, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const allUserIds = profiles.map((p) => p.id);

    // Fetch all active limits in one query
    const { data: allLimits } = await supabase
      .from("usage_limits")
      .select("*")
      .eq("active", true);

    const limitsByUser = new Map<string, typeof allLimits>();
    for (const limit of allLimits ?? []) {
      const userId = limit.user_id ?? "__global__";
      const list = limitsByUser.get(userId) ?? [];
      list.push(limit);
      limitsByUser.set(userId, list);
    }

    const globalLimits = limitsByUser.get("__global__") ?? [];

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const users = profiles.map((profile) => {
      const joinedThisMonth = profile.created_at >= thisMonth;
      const joinedLastMonth =
        profile.created_at >= lastMonth && profile.created_at < thisMonth;

      const userLimits = [
        ...(limitsByUser.get(profile.id) ?? []),
        ...globalLimits,
      ];

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        isAdmin: profile.is_admin,
        plan: profile.plan,
        subscriptionStatus: profile.subscription_status,
        joinedAt: profile.created_at,
        joinedThisMonth,
        joinedLastMonth,
        limits: userLimits,
      };
    });

    const stats = {
      totalUsers: profiles.length,
      activeSubscriptions: profiles.filter((p) => p.subscription_status === "active").length,
      newThisMonth: profiles.filter((p) => p.created_at >= thisMonth).length,
      admins: profiles.filter((p) => p.is_admin).length,
      byPlan: {
        free: profiles.filter((p) => p.plan === "free").length,
        active: profiles.filter((p) => p.plan === "active").length,
        canceled: profiles.filter((p) => p.plan === "canceled").length,
        expired: profiles.filter((p) => p.plan === "expired").length,
      },
    };

    // Unused variable suppression
    void allUserIds;

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error("Admin usage error:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
