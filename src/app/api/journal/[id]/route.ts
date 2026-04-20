import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

function serializeEntry(e: typeof journalEntries.$inferSelect) {
  return {
    id: e.id,
    user_id: e.userId,
    entry_date: e.entryDate,
    content: e.content,
    mood: e.mood,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeEntry(rows[0]));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await request.json();
  const allowedFields: Partial<typeof journalEntries.$inferInsert> = {};

  if (typeof body.content === "string") {
    if (body.content.trim() === "") {
      return NextResponse.json({ error: "content cannot be empty" }, { status: 400 });
    }
    allowedFields.content = body.content.trim();
  }

  if (body.entry_date !== undefined) {
    if (typeof body.entry_date !== "string") {
      return NextResponse.json(
        { error: "entry_date must be a string in YYYY-MM-DD format" },
        { status: 400 }
      );
    }
    allowedFields.entryDate = body.entry_date;
  }

  if (body.mood !== undefined) {
    if (body.mood === null) {
      allowedFields.mood = null;
    } else if (typeof body.mood !== "number" || body.mood < 1 || body.mood > 5) {
      return NextResponse.json(
        { error: "mood must be an integer between 1 and 5, or null" },
        { status: 400 }
      );
    } else {
      allowedFields.mood = body.mood;
    }
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updatedAt = new Date();

  try {
    const [row] = await db
      .update(journalEntries)
      .set(allowedFields)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeEntry(row));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
