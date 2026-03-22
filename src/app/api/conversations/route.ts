import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all conversations for current user with pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "0");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = page * limit;
  const projectId = searchParams.get("project_id");
  const tagId = searchParams.get("tag");

  let query = supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  if (tagId) {
    // Filter by tag through junction table
    const { data: taggedIds } = await supabase
      .from("conversation_tags")
      .select("conversation_id")
      .eq("tag_id", tagId);

    const ids = taggedIds?.map((t) => t.conversation_id) || [];
    if (ids.length === 0) {
      return NextResponse.json([]);
    }
    query = query.in("id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST create new conversation
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, model, project_id } = body;

  // Validate project ownership if project_id provided
  if (project_id) {
    const { error: projError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      title: title || "New Chat",
      model: model || "anthropic/claude-sonnet-4.5",
      project_id: project_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
