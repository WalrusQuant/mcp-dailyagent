import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { conflictResponse } from "@/lib/api-conflict";
import { serializeSession } from "@/lib/mcp/queries/focus";
import { readJsonBody } from "@/lib/api-body";
import { deleteFocusSession, FocusPatch, mutateFocusSession } from "@/lib/focus/mutations";
import { uuidSchema } from "@/lib/validation";

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

  const allowedFields: FocusPatch = {};

  if (typeof body.status === "string") {
    const validStatuses = ["active", "paused", "completed", "cancelled"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "status must be one of: active, paused, completed, cancelled" },
        { status: 400 }
      );
    }
    allowedFields.status = body.status as "active" | "paused" | "completed" | "cancelled";

    if (body.status === "completed") {
      if (body.completed_at !== undefined) {
        if (typeof body.completed_at !== "string" || Number.isNaN(new Date(body.completed_at as string).getTime())) {
          return NextResponse.json({ error: "completed_at must be a valid ISO timestamp" }, { status: 400 });
        }
        allowedFields.completedAt = new Date(body.completed_at as string);
      } else {
        allowedFields.completedAt = new Date();
      }
    }
  }

  if (typeof body.completed_at === "string") {
    if (Number.isNaN(new Date(body.completed_at).getTime())) {
      return NextResponse.json({ error: "completed_at must be a valid ISO timestamp" }, { status: 400 });
    }
    allowedFields.completedAt = new Date(body.completed_at);
  }

  if (typeof body.notes === "string" || body.notes === null) {
    allowedFields.notes = body.notes as string | null;
  }
  if (body.task_id !== undefined) {
    if (body.task_id !== null && (typeof body.task_id !== "string" || !uuidSchema.safeParse(body.task_id).success)) {
      return NextResponse.json({ error: "task_id must be a valid UUID or null" }, { status: 400 });
    }
    allowedFields.taskId = body.task_id as string | null;
  }
  if (body.duration_minutes !== undefined) {
    if (typeof body.duration_minutes !== "number" || !Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 480) {
      return NextResponse.json({ error: "duration_minutes must be an integer from 1 to 480" }, { status: 400 });
    }
    allowedFields.durationMinutes = body.duration_minutes;
  }
  if (body.break_minutes !== undefined) {
    if (typeof body.break_minutes !== "number" || !Number.isInteger(body.break_minutes) || body.break_minutes < 0 || body.break_minutes > 120) {
      return NextResponse.json({ error: "break_minutes must be an integer from 0 to 120" }, { status: 400 });
    }
    allowedFields.breakMinutes = body.break_minutes;
  }
  if (typeof body.started_at === "string") {
    const parsed = new Date(body.started_at);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "started_at must be a valid ISO timestamp" }, { status: 400 });
    allowedFields.startedAt = parsed;
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const result = await mutateFocusSession(userId, id, allowedFields, typeof body.expected_updated_at === "string" ? body.expected_updated_at : undefined);
    if (!result.ok) {
      if (result.error.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.error.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
      if (result.error.reason === "invalid_task") return NextResponse.json({ error: "task_id must reference one of your tasks" }, { status: 400 });
      return conflictResponse(serializeSession(result.error.current));
    }
    return NextResponse.json(serializeSession(result.row));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getUserId();

  try {
    const result = await deleteFocusSession(userId, id, request.nextUrl.searchParams.get("expected_updated_at") ?? undefined);
    if (!result.ok) {
      if (result.error.reason === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.error.reason === "invalid_token") return NextResponse.json({ error: "Invalid expected_updated_at" }, { status: 400 });
      if (result.error.reason === "conflict") return conflictResponse(serializeSession(result.error.current));
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
