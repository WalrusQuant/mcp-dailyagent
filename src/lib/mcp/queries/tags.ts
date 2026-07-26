import { db } from "@/lib/db/client";
import { tags, taskTags } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export function serializeTag(t: typeof tags.$inferSelect) {
  return {
    id: t.id,
    user_id: t.userId,
    name: t.name,
    color: t.color,
    created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

export type SerializedTag = ReturnType<typeof serializeTag>;

/** Replace all tags on a task with the given tag IDs (must belong to user). */
export async function setTaskTags(
  userId: string,
  taskId: string,
  tagIds: string[]
): Promise<void> {
  const unique = [...new Set(tagIds.filter(Boolean))];

  if (unique.length > 0) {
    const owned = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, unique)));
    const ownedIds = new Set(owned.map((t) => t.id));
    for (const id of unique) {
      if (!ownedIds.has(id)) {
        throw new Error(`Tag not found: ${id}`);
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(taskTags).where(eq(taskTags.taskId, taskId));
    if (unique.length > 0) {
      await tx.insert(taskTags).values(unique.map((tagId) => ({ taskId, tagId })));
    }
  });
}

/** Map taskId → serialized tags for a batch of tasks. */
export async function getTagsByTaskIds(
  taskIds: string[]
): Promise<Map<string, SerializedTag[]>> {
  const map = new Map<string, SerializedTag[]>();
  if (taskIds.length === 0) return map;

  const rows = await db
    .select({
      taskId: taskTags.taskId,
      tag: tags,
    })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(inArray(taskTags.taskId, taskIds));

  for (const row of rows) {
    const list = map.get(row.taskId) ?? [];
    list.push(serializeTag(row.tag));
    map.set(row.taskId, list);
  }
  return map;
}

export async function getTagsForTask(taskId: string): Promise<SerializedTag[]> {
  const map = await getTagsByTaskIds([taskId]);
  return map.get(taskId) ?? [];
}
