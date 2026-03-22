import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProductivitySnapshot, formatProductivityContext } from "@/lib/productivity-context";
import { complete } from "@/lib/llm";
import { getModelForTask } from "@/lib/ai-models";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";

const BRIEFING_SYSTEM_PROMPT =
  "Generate a warm, concise morning briefing (under 150 words) based on this productivity data. Mention priorities, streaks at risk, and one encouraging observation. Use a friendly, motivating tone. Do not use headers or bullet points — write it as natural paragraphs.";

async function generateBriefingContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const snapshot = await getProductivitySnapshot(supabase, userId);
  const context = formatProductivityContext(snapshot);

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_model_config")
    .eq("id", userId)
    .single();

  const model = await getModelForTask(profile, "briefing");

  const response = await complete(model, {
    messages: [
      { role: "system", content: BRIEFING_SYSTEM_PROMPT },
      { role: "user", content: context },
    ],
    max_tokens: 300,
  });

  return response.content?.trim() || "";
}

async function authenticateAndCheck() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profileCheck } = await supabase
    .from("profiles")
    .select("briefing_enabled, is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profileCheck?.is_admin === true;

  const rateLimited = checkRateLimit(user.id, "ai", isAdmin);
  if (rateLimited) return { error: rateLimited };

  const limits = await checkUsageLimits(supabase, user.id, isAdmin);
  if (limits.blocked) return { error: usageLimitResponse(limits.reason!) };

  return { supabase, user, profileCheck };
}

export async function GET() {
  const auth = await authenticateAndCheck();
  if ("error" in auth && !("supabase" in auth)) return auth.error;
  const { supabase, user, profileCheck } = auth as Exclude<typeof auth, { error: Response | NextResponse }>;

  if (profileCheck?.briefing_enabled === false) {
    return NextResponse.json({ content: null, disabled: true });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Check cache
  const { data: cached } = await supabase
    .from("daily_briefings")
    .select("content")
    .eq("user_id", user.id)
    .eq("briefing_date", today)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ content: cached.content, cached: true });
  }

  // Generate new briefing
  try {
    const content = await generateBriefingContent(supabase, user.id);

    if (content) {
      await supabase.from("daily_briefings").insert({
        user_id: user.id,
        briefing_date: today,
        content,
      });
    }

    return NextResponse.json({ content, cached: false });
  } catch (error) {
    console.error("Briefing generation failed:", error);
    return NextResponse.json({ content: null, error: "Generation failed" }, { status: 500 });
  }
}

export async function POST() {
  const auth = await authenticateAndCheck();
  if ("error" in auth && !("supabase" in auth)) return auth.error;
  const { supabase, user } = auth as Exclude<typeof auth, { error: Response | NextResponse }>;

  const today = new Date().toISOString().slice(0, 10);

  // Delete cached briefing for today
  await supabase
    .from("daily_briefings")
    .delete()
    .eq("user_id", user.id)
    .eq("briefing_date", today);

  // Generate fresh
  try {
    const content = await generateBriefingContent(supabase, user.id);

    if (content) {
      await supabase.from("daily_briefings").insert({
        user_id: user.id,
        briefing_date: today,
        content,
      });
    }

    return NextResponse.json({ content, cached: false });
  } catch (error) {
    console.error("Briefing regeneration failed:", error);
    return NextResponse.json({ content: null, error: "Generation failed" }, { status: 500 });
  }
}
