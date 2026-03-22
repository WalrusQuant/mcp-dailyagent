import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .lt("task_date", todayStr)
    .eq("done", false)
    .is("rolled_from", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
