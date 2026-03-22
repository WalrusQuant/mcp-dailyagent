import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";

// POST — test API key connectivity
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { provider, apiKey } = await request.json();

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 });
  }

  try {
    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/credits", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text}` });
      }
      const data = await res.json();
      return NextResponse.json({
        success: true,
        details: {
          balance: (data.data?.total_credits ?? 0) - (data.data?.total_usage ?? 0),
        },
      });
    }

    if (provider === "tavily") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: "test",
          max_results: 1,
          search_depth: "basic",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text}` });
      }
      return NextResponse.json({ success: true });
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text}` });
      }
      return NextResponse.json({ success: true });
    }

    if (provider === "google") {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
        headers: { "x-goog-api-key": apiKey },
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text}` });
      }
      return NextResponse.json({ success: true });
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text}` });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}
