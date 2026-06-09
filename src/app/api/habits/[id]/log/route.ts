import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { habits, habitLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { date } = body;

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
    return NextResponse.json(
      { error: "date is required and must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  const dateStr = date as string;

  try {
    // Verify the habit belongs to the user
    const habitRows = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));

    if (habitRows.length === 0) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    // Check if a log already exists for this habit + date
    const existingLogs = await db
      .select({ id: habitLogs.id })
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, id), eq(habitLogs.logDate, dateStr)));

    if (existingLogs.length > 0) {
      // Toggle off — delete the log
      await db.delete(habitLogs).where(eq(habitLogs.id, existingLogs[0].id));
      return NextResponse.json({ logged: false });
    } else {
      // Toggle on — create the log
      await db.insert(habitLogs).values({ habitId: id, logDate: dateStr, userId });
      return NextResponse.json({ logged: true });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
