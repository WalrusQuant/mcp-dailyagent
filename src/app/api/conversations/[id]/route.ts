import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET single conversation
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

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH update conversation
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

  // Whitelist allowed fields
  const allowedFields: Record<string, unknown> = {};
  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.model === "string") allowedFields.model = body.model;
  if (typeof body.project_id === "string" || body.project_id === null)
    allowedFields.project_id = body.project_id;
  if (typeof body.system_prompt === "string" || body.system_prompt === null)
    allowedFields.system_prompt = body.system_prompt;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate project ownership if project_id is being set
  if (allowedFields.project_id) {
    const { error: projError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", allowedFields.project_id as string)
      .eq("user_id", user.id)
      .single();

    if (projError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("conversations")
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

// DELETE conversation
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

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
