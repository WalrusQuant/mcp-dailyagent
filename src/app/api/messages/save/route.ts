import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

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

    const { conversationId, content, role, sources, promptTokens, completionTokens, totalCost } =
      (await request.json()) as {
        conversationId: string;
        content: string;
        role: string;
        sources?: Array<{ title: string; url: string }>;
        promptTokens?: number;
        completionTokens?: number;
        totalCost?: number;
      };

    if (!conversationId || !content || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role,
      content,
      prompt_tokens: promptTokens ?? null,
      completion_tokens: completionTokens ?? null,
      total_cost: totalCost ?? null,
      sources: sources ?? null,
    });

    if (insertError) {
      console.error("Failed to save message:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Save message error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
