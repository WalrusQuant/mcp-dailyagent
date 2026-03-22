import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all messages for a conversation
export async function GET(
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

  // First verify the conversation belongs to the user
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE messages after a certain index (for edit/regenerate branching)
export async function DELETE(
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

  // Verify conversation belongs to user
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { keepCount } = (await request.json()) as { keepCount: number };

  if (typeof keepCount !== "number" || keepCount < 0) {
    return NextResponse.json({ error: "Invalid keepCount" }, { status: 400 });
  }

  // Get all messages ordered by creation time
  const { data: allMessages, error: fetchError } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (fetchError || !allMessages) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  // Delete messages after keepCount
  const toDelete = allMessages.slice(keepCount).map((m) => m.id);

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("messages")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ deleted: toDelete.length });
}
