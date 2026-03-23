import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

let _serviceClient: SupabaseClient<Database> | null = null;

/** Service-role Supabase client for MCP requests (bypasses RLS) */
export function getServiceClient(): SupabaseClient<Database> {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _serviceClient = createClient<Database>(url, key);
  return _serviceClient;
}
