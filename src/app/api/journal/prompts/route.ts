import { createClient } from "@/lib/supabase/server";
import { complete } from "@/lib/llm";
import { NextResponse } from "next/server";
import { getModelForTask } from "@/lib/ai-models";
import { checkRateLimit } from "@/lib/rate-limit";

const FALLBACK_PROMPTS = [
  "What am I grateful for today?",
  "What challenged me and how did I respond?",
  "What do I want to focus on tomorrow?",
];

// GET generate 3 journal prompts via LLM
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminCheck } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = adminCheck?.is_admin === true;

  const rateLimited = checkRateLimit(user.id, "ai", isAdmin);
  if (rateLimited) return rateLimited;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_model_config")
      .eq("id", user.id)
      .single();

    const promptModel = await getModelForTask(profile, "briefing");
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const response = await complete(promptModel, {
      messages: [
        {
          role: "system",
          content:
            "You generate short, thoughtful journal prompts. Respond with exactly 3 prompts, one per line, with no numbering, bullets, or extra formatting. Each prompt should be a single concise question.",
        },
        {
          role: "user",
          content: `Today is ${today}. Give me 3 journal prompts for today.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const raw = response.content?.trim() ?? "";
    const prompts = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    if (prompts.length < 3) {
      return NextResponse.json({ prompts: FALLBACK_PROMPTS });
    }

    return NextResponse.json({ prompts });
  } catch {
    return NextResponse.json({ prompts: FALLBACK_PROMPTS });
  }
}
