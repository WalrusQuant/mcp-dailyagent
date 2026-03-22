import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: file, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("id", fileId)
    .eq("project_id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data: signedUrl } = await supabase.storage
    .from("project-files")
    .createSignedUrl(file.storage_path, 3600); // 1 hour

  if (!signedUrl) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl, file });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: file, error: fileError } = await supabase
    .from("project_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("project_id", id)
    .eq("user_id", user.id)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await supabase.storage.from("project-files").remove([file.storage_path]);

  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("id", fileId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
