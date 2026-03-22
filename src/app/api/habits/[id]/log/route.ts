import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST toggle habit log for a given date
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

  const body = await request.json();
  const { date } = body;

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date is required and must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  // Verify the habit belongs to the user
  const { error: habitError } = await supabase
    .from("habits")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (habitError) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }

  // Check if a log already exists for this habit + date
  const { data: existingLog } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("habit_id", id)
    .eq("log_date", date)
    .single();

  if (existingLog) {
    // Toggle off — delete the log
    const { error: deleteError } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", existingLog.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ logged: false });
  } else {
    // Toggle on — create the log
    const { error: insertError } = await supabase
      .from("habit_logs")
      .insert({ habit_id: id, log_date: date, user_id: user.id });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ logged: true });
  }
}
