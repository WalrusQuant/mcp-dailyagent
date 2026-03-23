import { SupabaseClient } from "@supabase/supabase-js";
import { QueryResult } from "@/lib/mcp/types";

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "completed";
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
  status?: string;
}

export interface UpdateSpaceFields {
  name?: string;
  description?: string | null;
  status?: string;
}

export async function getSpaces(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<Space[]>> {
  try {
    const { data, error } = await supabase
      .from("spaces")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as Space[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createSpace(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSpaceInput
): Promise<QueryResult<Space>> {
  try {
    const { data, error } = await supabase
      .from("spaces")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description || null,
        status: input.status || "active",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Space, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateSpace(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string,
  fields: UpdateSpaceFields
): Promise<QueryResult<Space>> {
  try {
    const allowedFields: Record<string, unknown> = {};

    if (typeof fields.name === "string") allowedFields.name = fields.name;
    if (typeof fields.description === "string" || fields.description === null)
      allowedFields.description = fields.description;
    if (
      typeof fields.status === "string" &&
      ["active", "paused", "completed"].includes(fields.status)
    ) {
      allowedFields.status = fields.status;
    }

    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("spaces")
      .update(allowedFields)
      .eq("id", spaceId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Space, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
