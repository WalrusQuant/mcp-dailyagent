import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
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

export async function GET(request: NextRequest) {
  const userId = getUserId();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  try {
    let rows;

    if (date) {
      rows = await db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, date)))
        .orderBy(desc(journalEntries.entryDate));
    } else if (from && to) {
      rows = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.userId, userId),
            gte(journalEntries.entryDate, from),
            lte(journalEntries.entryDate, to)
          )
        )
        .orderBy(desc(journalEntries.entryDate));
    } else if (search) {
      rows = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.userId, userId),
            sql`to_tsvector('english', ${journalEntries.content}) @@ plainto_tsquery('english', ${search})`
          )
        )
        .orderBy(desc(journalEntries.entryDate));
    } else {
      rows = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .orderBy(desc(journalEntries.entryDate))
        .limit(30);
    }

    return NextResponse.json(rows.map(serializeEntry));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();

  const body = await request.json();
  const { content, entry_date, mood } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (mood !== undefined && mood !== null) {
    if (typeof mood !== "number" || mood < 1 || mood > 5) {
      return NextResponse.json(
        { error: "mood must be an integer between 1 and 5, or null" },
        { status: 400 }
      );
    }
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [row] = await db
      .insert(journalEntries)
      .values({
        userId,
        content: content.trim(),
        entryDate: entry_date || today,
        mood: mood ?? null,
      })
      .returning();

    return NextResponse.json(serializeEntry(row), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
