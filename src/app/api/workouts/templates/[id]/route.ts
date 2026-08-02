import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workoutTemplates, workoutExercises } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { serializeTemplate } from "@/lib/mcp/queries/workouts";
import { readJsonBody } from "@/lib/api-body";
import { updateWorkoutTemplate } from "@/lib/workouts/templates";

async function getTemplateWithExercises(id: string, userId: string) {
  const rows = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));

  if (rows.length === 0) return null;

  const exercises = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.templateId, id))
    .orderBy(workoutExercises.sortOrder);

  return serializeTemplate(rows[0], exercises);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const result = await getTemplateWithExercises(id, userId);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  const body = await readJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
  }
  if (body.description !== undefined && typeof body.description !== "string" && body.description !== null) {
    return NextResponse.json({ error: "description must be a string or null" }, { status: 400 });
  }
  if (body.exercises !== undefined && !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "exercises must be an array" }, { status: 400 });
  }
  if (body.name === undefined && body.description === undefined && body.exercises === undefined) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const result = await updateWorkoutTemplate(userId, id, {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: body.description as string | null | undefined,
      exercises: body.exercises,
    });
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      .delete(workoutTemplates)
      .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
