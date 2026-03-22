import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "txt", "md", "json", "csv", "png", "jpg", "jpeg", "gif", "webp",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

  // Verify project ownership
  const { error: projError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projError) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
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

  // Verify project ownership
  const { error: projError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projError) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}` },
      { status: 400 }
    );
  }

  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${id}/${fileId}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error: dbError } = await supabase
    .from("project_files")
    .insert({
      project_id: id,
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
      file_type: file.type || ext,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file on DB error
    await supabase.storage.from("project-files").remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
