import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createDateContext, type DateContext } from "@/lib/zoned-dates";
export * from "@/lib/zoned-dates";

export async function resolveDateContext(userId: string, now = new Date()): Promise<DateContext> {
  const [profile] = await db.select({ timezone: profiles.timezone }).from(profiles)
    .where(eq(profiles.id, userId)).limit(1);
  return createDateContext(profile?.timezone ?? "UTC", now);
}

export async function getProfileToday(userId: string, now = new Date()): Promise<string> {
  return (await resolveDateContext(userId, now)).today;
}
