import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

const KEY_PREFIX = "da_sk_";

/**
 * Generate a new API key.
 * Returns the full key (shown once) and the hash (stored).
 */
export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(36);
  const keyBody = randomBytes.toString("base64url");
  const fullKey = `${KEY_PREFIX}${keyBody}`;
  const prefix = fullKey.slice(0, 12);
  const hash = hashKey(fullKey);
  return { fullKey, prefix, hash };
}

/**
 * SHA-256 hash of a key for storage/lookup.
 */
export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key and return the user_id if valid.
 * Returns null if invalid, revoked, or expired.
 */
export async function validateApiKey(key: string): Promise<{
  userId: string;
  keyId: string;
  scopes: string[];
} | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;

  const hash = hashKey(key);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, scopes, revoked_at, expires_at")
    .eq("key_hash", hash)
    .single();

  if (error || !data) return null;

  // Check if revoked
  if (data.revoked_at) return null;

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    userId: data.user_id,
    keyId: data.id,
    scopes: data.scopes || [],
  };
}

/**
 * Check if a bearer token is an API key (vs OAuth token).
 */
export function isApiKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}
