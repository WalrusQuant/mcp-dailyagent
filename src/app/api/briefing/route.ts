import { resolveDateContext } from "@/lib/date-context";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { dailyBriefings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/profile-capabilities";

export async function GET() {
  try {
    const userId = getUserId();
    const { briefingEnabled } = await getProfileCapabilities(userId);
    if (!briefingEnabled) {
      return NextResponse.json({ error: "Daily briefings are disabled" }, { status: 403 });
    }
    const { today } = await resolveDateContext(userId);

    const rows = await db
      .select()
      .from(dailyBriefings)
      .where(and(eq(dailyBriefings.userId, userId), eq(dailyBriefings.briefingDate, today)));

    const row = rows[0];
    return NextResponse.json({
      content: row?.content ?? null,
      briefing_date: row?.briefingDate ?? today,
      updated_at: row?.updatedAt ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
