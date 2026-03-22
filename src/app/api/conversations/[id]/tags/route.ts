import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

  // Verify conversation ownership
  const { error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("conversation_tags")
    .select("tag_id, tags(*)")
    .eq("conversation_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tags = (data as Array<{ tag_id: string; tags: unknown }>)?.map((ct) => ct.tags).filter(Boolean) || [];
  return NextResponse.json(tags);
}

export async function PUT(
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

  // Verify conversation ownership
  const { error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { tagIds } = await request.json();

  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
  }

  // Get existing tags before modification
  const { data: existingTags } = await supabase
    .from("conversation_tags")
    .select("tag_id")
    .eq("conversation_id", id);

  // Delete existing tags
  await supabase
    .from("conversation_tags")
    .delete()
    .eq("conversation_id", id);

  // Insert new tags
  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId: string) => ({
      conversation_id: id,
      tag_id: tagId,
    }));

    const { error } = await supabase
      .from("conversation_tags")
      .insert(rows);

    if (error) {
      // Rollback: restore previous tags
      if (existingTags && existingTags.length > 0) {
        const rollbackRows = existingTags.map((t) => ({
          conversation_id: id,
          tag_id: t.tag_id,
        }));
        await supabase.from("conversation_tags").insert(rollbackRows);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
