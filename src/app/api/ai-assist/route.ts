import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/llm";
import { getModelForTask } from "@/lib/ai-models";
import { getProductivitySnapshot, formatProductivityContext } from "@/lib/productivity-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";

type AssistType = "journal_reflection" | "habit_coaching" | "workout_suggestion" | "task_breakdown";

const SYSTEM_PROMPTS: Record<AssistType, string> = {
  journal_reflection:
    "You are a thoughtful journaling coach. Based on the user's journal entry and mood, provide a brief, empathetic reflection (2-3 paragraphs). Highlight patterns, ask one thought-provoking question, and offer a gentle observation. Keep it under 150 words.",
  habit_coaching:
    "You are a habit coach. Based on the user's habit data and streaks, provide 2-3 specific, actionable suggestions to improve consistency. Be encouraging about progress and direct about areas to improve. Keep it under 150 words.",
  workout_suggestion:
    "You are a personal trainer. Based on the user's recent workout history, suggest a workout for today. Consider muscle group rotation and recovery. Return a specific workout plan with exercises, sets, and reps. Keep it under 200 words.",
  task_breakdown:
    "You are a productivity coach. Break down the given task into 3-6 concrete subtasks. Return ONLY a JSON array of strings, each being a subtask title. Example: [\"Research options\", \"Draft outline\", \"Write first section\"]",
};

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

  const rateLimited = checkRateLimit(user.id, "ai", isAdmin);
  if (rateLimited) return rateLimited;

  const limits = await checkUsageLimits(supabase, user.id, isAdmin);
  if (limits.blocked) return usageLimitResponse(limits.reason!);

  const { type, context } = (await request.json()) as {
    type: AssistType;
    context: Record<string, unknown>;
  };

  if (!type || !SYSTEM_PROMPTS[type]) {
    return NextResponse.json({ error: "Invalid assist type" }, { status: 400 });
  }

  try {
    // Get broader context
    const snapshot = await getProductivitySnapshot(supabase, user.id);
    const productivityContext = formatProductivityContext(snapshot);

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_model_config")
      .eq("id", user.id)
      .single();

    const model = await getModelForTask(profile, "assist");

    const userContent = `${productivityContext}\n\nSpecific context:\n${JSON.stringify(context, null, 2)}`;

    const response = await complete(model, {
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[type] },
        { role: "user", content: userContent },
      ],
      max_tokens: 500,
    });

    const content = response.content?.trim() || "";
    return NextResponse.json({ content });
  } catch (error) {
    console.error("AI assist failed:", error);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
