import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/tools/executor";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";
import { READ_ONLY_TOOLS } from "@/lib/tools/definitions";

// Mutation tools that require client-side approval before execution
const MUTATION_TOOLS = new Set([
  "create_task",
  "complete_task",
  "log_habit",
  "create_journal_entry",
  "start_focus_session",
  "create_goal",
  "update_goal_progress",
]);

const ALLOWED_TOOLS = new Set([...MUTATION_TOOLS, ...READ_ONLY_TOOLS]);

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

  const rateLimited = checkRateLimit(user.id, "chat", isAdmin);
  if (rateLimited) return rateLimited;

  const limits = await checkUsageLimits(supabase, user.id, isAdmin);
  if (limits.blocked) return usageLimitResponse(limits.reason!);

  const { toolName, arguments: args } = (await request.json()) as {
    toolName: string;
    arguments: Record<string, unknown>;
  };

  if (!toolName || typeof toolName !== "string") {
    return NextResponse.json({ error: "toolName is required" }, { status: 400 });
  }

  if (!ALLOWED_TOOLS.has(toolName)) {
    return NextResponse.json({ error: "Unknown or disallowed tool" }, { status: 400 });
  }

  const result = await executeTool(supabase, user.id, toolName, args ?? {});
  return NextResponse.json({ result });
}
