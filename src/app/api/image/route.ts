import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUsageLimits, usageLimitResponse } from "@/lib/usage-limits";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: adminCheck } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = adminCheck?.is_admin === true;

    const rateLimited = checkRateLimit(user.id, "image", isAdmin);
    if (rateLimited) return rateLimited;

    const limits = await checkUsageLimits(supabase, user.id, isAdmin);
    if (limits.blocked) return usageLimitResponse(limits.reason!);

    const { prompt, model } = (await request.json()) as {
      prompt: string;
      model?: string;
    };

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const selectedModel = model || "google/gemini-2.5-flash-image";

    // Validate model exists in app_models
    if (model) {
      const { data: validModel } = await supabase
        .from("app_models")
        .select("model_id")
        .eq("model_id", model)
        .eq("type", "image")
        .single();

      if (!validModel) {
        return new Response(
          JSON.stringify({ error: "Invalid model" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const result = await generateImage(selectedModel, prompt);

    return new Response(
      JSON.stringify({ data: [{ url: result.image_url }] }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Image API error:", error);
    const message = error instanceof Error ? error.message : "An error occurred processing your request";
    const isUserError = message.includes("did not generate") || message.includes("does not support");
    return new Response(
      JSON.stringify({ error: isUserError ? message : "Image generation failed" }),
      {
        status: isUserError ? 400 : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
