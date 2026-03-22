import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// PATCH update a focus session
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

  if (typeof body.status === "string") {
    const validStatuses = ["active", "completed", "cancelled"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "status must be one of: active, completed, cancelled" },
        { status: 400 }
      );
    }
    allowedFields.status = body.status;

    // Auto-set completed_at when marking as completed
    if (body.status === "completed") {
      allowedFields.completed_at = body.completed_at ?? new Date().toISOString();
    }
  }

  if (typeof body.completed_at === "string") {
    allowedFields.completed_at = body.completed_at;
  }

  if (typeof body.notes === "string" || body.notes === null) {
    allowedFields.notes = body.notes;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("focus_sessions")
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

// DELETE a focus session
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
    .from("focus_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
