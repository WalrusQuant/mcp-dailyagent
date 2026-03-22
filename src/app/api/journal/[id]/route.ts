import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET single journal entry by id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH update a journal entry — whitelist: content, mood, entry_date
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowedFields: Record<string, unknown> = {};

  if (typeof body.content === "string") {
    if (body.content.trim() === "") {
      return NextResponse.json(
        { error: "content cannot be empty" },
        { status: 400 }
      );
    }
    allowedFields.content = body.content.trim();
  }

  if (body.entry_date !== undefined) {
    if (typeof body.entry_date !== "string") {
      return NextResponse.json(
        { error: "entry_date must be a string in YYYY-MM-DD format" },
        { status: 400 }
      );
    }
    allowedFields.entry_date = body.entry_date;
  }

  if (body.mood !== undefined) {
    if (body.mood === null) {
      allowedFields.mood = null;
    } else if (
      typeof body.mood !== "number" ||
      body.mood < 1 ||
      body.mood > 5
    ) {
      return NextResponse.json(
        { error: "mood must be an integer between 1 and 5, or null" },
        { status: 400 }
      );
    } else {
      allowedFields.mood = body.mood;
    }
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  allowedFields.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("journal_entries")
    .update(allowedFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE a journal entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
