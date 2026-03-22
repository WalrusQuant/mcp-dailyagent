import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - fetch all images for the current user
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: images, error } = await supabase
    .from("generated_images")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(images);
}

// POST - save a new generated image
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt, image_url, model } = await request.json();

  if (!prompt || !image_url) {
    return NextResponse.json(
      { error: "Prompt and image_url are required" },
      { status: 400 }
    );
  }

  const { data: image, error } = await supabase
    .from("generated_images")
    .insert({
      user_id: user.id,
      prompt,
      image_url,
      model: model || "google/gemini-2.5-flash-image",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(image);
}
