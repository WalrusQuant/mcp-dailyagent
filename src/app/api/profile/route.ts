import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-body";
import { ianaTimezoneSchema } from "@/lib/validation";

export async function GET() {
  try {
    const userId = getUserId();
    const [profile] = await db
      .select({
        displayName: profiles.displayName,
        timezone: profiles.timezone,
        toolCallingEnabled: profiles.toolCallingEnabled,
        briefingEnabled: profiles.briefingEnabled,
      })
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      display_name: profile.displayName ?? null,
      timezone: profile.timezone ?? "UTC",
      tool_calling_enabled: profile.toolCallingEnabled ?? true,
      briefing_enabled: profile.briefingEnabled ?? true,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const userId = getUserId();
    const allowed: Partial<typeof profiles.$inferInsert> = {};

    // Accept snake_case (canonical API contract). Clients should send snake_case.
    const displayName = "display_name" in body ? body.display_name : undefined;
    if (typeof displayName === "string" || displayName === null) {
      allowed.displayName = (displayName as string) || null;
    }

    if (body.timezone !== undefined) {
      const timezone = ianaTimezoneSchema.safeParse(body.timezone);
      if (!timezone.success) {
        return NextResponse.json({ error: "timezone must be a valid IANA timezone" }, { status: 400 });
      }
      allowed.timezone = timezone.data;
    }

    const toolCallingEnabled =
      "tool_calling_enabled" in body ? body.tool_calling_enabled : undefined;
    if (typeof toolCallingEnabled === "boolean") {
      allowed.toolCallingEnabled = toolCallingEnabled;
    }

    const briefingEnabled =
      "briefing_enabled" in body ? body.briefing_enabled : undefined;
    if (typeof briefingEnabled === "boolean") {
      allowed.briefingEnabled = briefingEnabled;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    allowed.updatedAt = new Date();

    await db.update(profiles).set(allowed).where(eq(profiles.id, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = getUserId();
    await db
      .update(profiles)
      .set({ displayName: null, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
