import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, FORBIDDEN } from "@/lib/admin";
import { encrypt, decrypt, maskSecret } from "@/lib/encryption";
import { invalidateCache, getEnvFallbacks, ENCRYPTED_KEYS } from "@/lib/app-config";

// GET — return all settings with masked secrets
export async function GET() {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { data: rows, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const envFallbacks = getEnvFallbacks();

  // Build settings map with masked values for encrypted keys
  const settings = (rows || []).map((row) => {
    if (row.is_encrypted) {
      let masked = "";
      try {
        const plain = decrypt(row.value);
        masked = maskSecret(plain);
      } catch {
        masked = "••••";
      }
      return {
        key: row.key,
        configured: true,
        masked,
        is_encrypted: true,
        category: row.category,
        description: row.description,
        updated_at: row.updated_at,
      };
    }

    return {
      key: row.key,
      value: row.value,
      configured: true,
      is_encrypted: false,
      category: row.category,
      description: row.description,
      updated_at: row.updated_at,
    };
  });

  // Add env fallback status for all known keys
  const envStatus: Record<string, boolean> = {};
  for (const [dbKey, envVar] of Object.entries(envFallbacks)) {
    envStatus[dbKey] = !!process.env[envVar];
  }

  return NextResponse.json({ settings, envStatus });
}

// PUT — upsert a setting
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { key, value, category, description } = await request.json();

  if (!key || typeof key !== "string" || !value || typeof value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const isEncrypted = ENCRYPTED_KEYS.has(key);
  const storedValue = isEncrypted ? encrypt(value) : value;

  const { error } = await supabase.from("app_settings").upsert(
    {
      key,
      value: storedValue,
      is_encrypted: isEncrypted,
      category: category || "general",
      description: description || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invalidate config cache
  invalidateCache(key);

  // If any API key changed, reset adapter cache
  if (ENCRYPTED_KEYS.has(key)) {
    const { resetAdapters } = await import("@/lib/llm");
    resetAdapters();
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a setting (reverts to env fallback)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user, isAdmin } = await requireAdmin(supabase);

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) return FORBIDDEN;

  const { key } = await request.json();

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { error } = await supabase.from("app_settings").delete().eq("key", key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateCache(key);

  return NextResponse.json({ success: true });
}
