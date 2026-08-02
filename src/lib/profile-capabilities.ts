import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

export interface ProfileCapabilities {
  briefingEnabled: boolean;
  toolCallingEnabled: boolean;
}

/** Resolve server-enforced feature gates. Missing legacy profiles keep safe defaults. */
export async function getProfileCapabilities(userId: string): Promise<ProfileCapabilities> {
  const [profile] = await db
    .select({
      briefingEnabled: profiles.briefingEnabled,
      toolCallingEnabled: profiles.toolCallingEnabled,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return {
    briefingEnabled: profile?.briefingEnabled ?? true,
    toolCallingEnabled: profile?.toolCallingEnabled ?? true,
  };
}
