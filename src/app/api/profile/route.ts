import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-body";

export async function GET() {
  try {
    const userId = getUserId();
    const [profile] = await db
      .select({
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        timezone: profiles.timezone,
        toolCallingEnabled: profiles.toolCallingEnabled,
        briefingEnabled: profiles.briefingEnabled,
        aiModelConfig: profiles.aiModelConfig,
      })
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      display_name: profile.displayName ?? null,
      avatar_url: profile.avatarUrl ?? null,
      timezone: profile.timezone ?? "UTC",
      tool_calling_enabled: profile.toolCallingEnabled ?? true,
      briefing_enabled: profile.briefingEnabled ?? true,
      ai_model_config: profile.aiModelConfig ?? null,
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

    const avatarUrl = "avatar_url" in body ? body.avatar_url : undefined;
    if (typeof avatarUrl === "string" || avatarUrl === null) {
      allowed.avatarUrl = (avatarUrl as string) || null;
    }

    if (typeof body.timezone === "string") {
      allowed.timezone = body.timezone;
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

    const aiModelConfig =
      "ai_model_config" in body ? body.ai_model_config : undefined;
    if (aiModelConfig !== undefined) {
      if (aiModelConfig === null || typeof aiModelConfig === "object") {
        allowed.aiModelConfig = aiModelConfig as object | null;
      }
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
      .set({ displayName: null, avatarUrl: null, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
