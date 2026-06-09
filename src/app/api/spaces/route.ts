import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeSpace } from "@/lib/mcp/queries/spaces";
import { readJsonBody } from "@/lib/api-body";

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const conditions =
      status && ["active", "paused", "completed"].includes(status)
        ? and(eq(spaces.userId, userId), eq(spaces.status, status as "active" | "paused" | "completed"))
        : eq(spaces.userId, userId);

    const rows = await db
      .select()
      .from(spaces)
      .where(conditions)
      .orderBy(desc(spaces.updatedAt));

    return NextResponse.json(rows.map(serializeSpace));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description, status, deadline } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(spaces)
      .values({
        userId,
        name: name.trim(),
        description: (description as string)?.trim() || null,
        status: (status as string) || "active",
        deadline: (deadline as string) || null,
      })
      .returning();

    return NextResponse.json(serializeSpace(row), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
