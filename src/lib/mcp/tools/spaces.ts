import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getServiceClient } from "@/lib/mcp/supabase";
import { getAuth, checkScope, textResult, errorResult, NOT_AUTHENTICATED, PAID_PLAN_REQUIRED, Extra } from "./helpers";

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function getSpaces(userId: string) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return { data, error: error?.message ?? null };
}

async function createSpace(
  userId: string,
  args: {
    name: string;
    description?: string;
  }
) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("spaces")
    .insert({
      user_id: userId,
      name: args.name,
      description: args.description ?? null,
      status: "active",
    })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

async function updateSpace(
  userId: string,
  args: {
    space_id: string;
    name?: string;
    description?: string;
    status?: string;
  }
) {
  const supabase = getServiceClient();

  const updates: Record<string, unknown> = {};
  if (args.name !== undefined) updates.name = args.name;
  if (args.description !== undefined) updates.description = args.description;
  if (args.status !== undefined) updates.status = args.status;

  const { data, error } = await supabase
    .from("spaces")
    .update(updates)
    .eq("id", args.space_id)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSpaceTools(server: McpServer) {
  // --- list_spaces (READ) ---
  server.tool(
    "list_spaces",
    "List all spaces (projects) for the authenticated user",
    {},
    async (_args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:read");
      if (scopeError) return errorResult(scopeError);

      const result = await getSpaces(auth.userId);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- create_space (WRITE) ---
  server.tool(
    "create_space",
    "Create a new space (project) to organize tasks",
    {
      name: z.string().describe("Space name"),
      description: z.string().optional().describe("Space description"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await createSpace(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );

  // --- update_space (WRITE) ---
  server.tool(
    "update_space",
    "Update a space's name, description, or status",
    {
      space_id: z.string().describe("Space ID"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      status: z.string().optional().describe("New status: active or archived"),
    },
    async (args, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return NOT_AUTHENTICATED;

      const scopeError = checkScope(auth.scopes, "spaces:write");
      if (scopeError) return errorResult(scopeError);

      if (auth.plan !== "active") return PAID_PLAN_REQUIRED;

      const result = await updateSpace(auth.userId, args);
      if (result.error) return errorResult(`Error: ${result.error}`);

      return textResult(result.data);
    }
  );
}
