import { tags } from "@/lib/db/schema";

export function serializeTag(t: typeof tags.$inferSelect) {
  return {
    id: t.id,
    user_id: t.userId,
    name: t.name,
    color: t.color,
    created_at: t.createdAt,
  };
}
