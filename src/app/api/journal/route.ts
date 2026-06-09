import { getToday } from "@/lib/dates";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeEntry } from "@/lib/mcp/queries/journal";
import { isUniqueViolation } from "@/lib/api-conflict";
import { readJsonBody } from "@/lib/api-body";

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

  const { content, entry_date, mood } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (entry_date !== undefined && (typeof entry_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date as string))) {
    return NextResponse.json({ error: "entry_date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  if (mood !== undefined && mood !== null) {
    if (typeof mood !== "number" || !Number.isInteger(mood) || mood < 1 || mood > 5) {
      return NextResponse.json(
        { error: "mood must be an integer between 1 and 5, or null" },
        { status: 400 }
      );
    }
  }

  const today = getToday();

  try {
    const [row] = await db
      .insert(journalEntries)
      .values({
        userId,
        content: content.trim(),
        entryDate: (entry_date as string) || today,
        mood: (mood as number) ?? null,
      })
      .returning();

    return NextResponse.json(serializeEntry(row), { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "A journal entry already exists for this date" },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
