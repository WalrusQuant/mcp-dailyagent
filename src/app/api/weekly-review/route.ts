import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET weekly review for a given week
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");

  if (!week) {
    return NextResponse.json(
      { error: "week query parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start", week)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null, { status: 200 });
  }

  return NextResponse.json(data);
}

// POST create or update a weekly review
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { week_start, content } = body;

  if (typeof week_start !== "string" || !week_start.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json(
      { error: "week_start must be a date string in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        user_id: user.id,
        week_start,
        content,
      },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
