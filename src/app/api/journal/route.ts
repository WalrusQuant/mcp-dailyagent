import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET journal entries — supports ?date=, ?from=&to=, ?search=, or defaults to last 30
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  if (date) {
    query = query.eq("entry_date", date);
  } else if (from && to) {
    query = query.gte("entry_date", from).lte("entry_date", to);
  } else if (search) {
    query = query.textSearch("content", search, { type: "websearch" });
  } else {
    query = query.limit(30);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create a new journal entry
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { content, entry_date, mood } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  if (mood !== undefined && mood !== null) {
    if (typeof mood !== "number" || mood < 1 || mood > 5) {
      return NextResponse.json(
        { error: "mood must be an integer between 1 and 5, or null" },
        { status: 400 }
      );
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      content: content.trim(),
      entry_date: entry_date || today,
      mood: mood ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
