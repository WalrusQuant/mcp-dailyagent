import { createClient } from "@/lib/supabase/server";
import { searchWeb } from "@/lib/tavily";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminCheck } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = adminCheck?.is_admin === true;

  const rateLimited = checkRateLimit(user.id, "search", isAdmin);
  if (rateLimited) return rateLimited;

  const limits = await checkUsageLimits(supabase, user.id, isAdmin);
  if (limits.blocked) return usageLimitResponse(limits.reason!);

  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const results = await searchWeb(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Web search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
