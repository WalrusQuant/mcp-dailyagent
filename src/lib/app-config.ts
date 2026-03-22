import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

/** DB key → env var fallback mapping */
const ENV_FALLBACKS: Record<string, string> = {
  openrouter_api_key: "OPENROUTER_API_KEY",
  anthropic_api_key: "ANTHROPIC_API_KEY",
  google_api_key: "GOOGLE_API_KEY",
  openai_api_key: "OPENAI_API_KEY",
  tavily_api_key: "TAVILY_API_KEY",
  signup_secret: "SIGNUP_SECRET",
  title_model: "TITLE_MODEL",
  default_chat_model: "DEFAULT_CHAT_MODEL",
  default_image_model: "DEFAULT_IMAGE_MODEL",
  site_name: "NEXT_PUBLIC_SITE_NAME",
  site_description: "NEXT_PUBLIC_SITE_DESCRIPTION",
  site_url: "NEXT_PUBLIC_SITE_URL",
};

export const ENCRYPTED_KEYS = new Set([
  "openrouter_api_key",
  "anthropic_api_key",
  "google_api_key",
  "openai_api_key",
  "tavily_api_key",
  "signup_secret",
]);

interface CacheEntry {
  value: string | null;
  ts: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Get a config value. Priority: cache → DB → env var fallback.
 * Returns null if not found anywhere.
 */
export async function getConfig(key: string): Promise<string | null> {
  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.value;
  }

  // Try DB via RPC (SECURITY DEFINER bypasses RLS)
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_app_setting", { setting_key: key });

    if (data && Array.isArray(data) && data.length > 0) {
      const row = data[0] as { value: string; is_encrypted: boolean };
      let value = row.value;

      if (row.is_encrypted) {
        value = decrypt(value);
      }

      cache.set(key, { value, ts: Date.now() });
      return value;
    }
  } catch (err) {
    // DB might not have the table yet — fall through to env
    console.error(`Failed to read config "${key}" from DB:`, err);
  }

  // Fall back to env var
  const envKey = ENV_FALLBACKS[key];
  const envValue = envKey ? process.env[envKey] ?? null : null;

  cache.set(key, { value: envValue, ts: Date.now() });
  return envValue;
}

/**
 * Get a config value, throw if missing from both DB and env.
 */
export async function getConfigRequired(key: string): Promise<string> {
  const value = await getConfig(key);
  if (!value) {
    const envKey = ENV_FALLBACKS[key] || key;
    throw new Error(
      `Configuration "${key}" is not set. Configure it in Admin Settings or set ${envKey} environment variable.`
    );
  }
  return value;
}

/**
 * Invalidate cached config. Call after updating settings.
 */
export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Get the env fallback mapping (for admin UI to show fallback status).
 */
export function getEnvFallbacks(): Record<string, string> {
  return { ...ENV_FALLBACKS };
}
