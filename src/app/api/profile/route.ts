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
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      timezone: profile.timezone ?? "UTC",
      toolCallingEnabled: profile.toolCallingEnabled ?? true,
      briefingEnabled: profile.briefingEnabled ?? true,
      aiModelConfig: profile.aiModelConfig ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
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

    if (typeof body.displayName === "string" || body.displayName === null) {
      allowed.displayName = (body.displayName as string) || null;
    }

    if (typeof body.avatarUrl === "string" || body.avatarUrl === null) {
      allowed.avatarUrl = (body.avatarUrl as string) || null;
    }

    if (typeof body.timezone === "string") {
      allowed.timezone = body.timezone;
    }

    if (typeof body.toolCallingEnabled === "boolean") {
      allowed.toolCallingEnabled = body.toolCallingEnabled;
    }

    if (typeof body.briefingEnabled === "boolean") {
      allowed.briefingEnabled = body.briefingEnabled;
    }

    if (body.aiModelConfig !== undefined) {
      if (body.aiModelConfig === null || typeof body.aiModelConfig === "object") {
        allowed.aiModelConfig = body.aiModelConfig as object | null;
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    allowed.updatedAt = new Date();

    await db.update(profiles).set(allowed).where(eq(profiles.id, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
