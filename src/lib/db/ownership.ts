import { and, eq, inArray } from "drizzle-orm";
import { db, type Database } from "@/lib/db/client";
import { goals, spaces, tags, tasks, workoutTemplates } from "@/lib/db/schema";

export type OwnedRelationship = "space" | "goal" | "tag" | "task" | "workout_template";
export type OwnershipClient = Pick<Database, "select">;

/**
 * Check a relationship target against both its primary key and owner.
 * Accepting a database client keeps the check usable inside an existing
 * transaction, so validation and the dependent write can commit atomically.
 */
export async function isOwnedRelationship(
  client: OwnershipClient,
  relationship: OwnedRelationship,
  id: string,
  userId: string
): Promise<boolean> {
  switch (relationship) {
    case "space":
      return hasRow(
        client.select({ id: spaces.id }).from(spaces).where(and(eq(spaces.id, id), eq(spaces.userId, userId)))
      );
    case "goal":
      return hasRow(
        client.select({ id: goals.id }).from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)))
      );
    case "tag":
      return hasRow(
        client.select({ id: tags.id }).from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)))
      );
    case "task":
      return hasRow(
        client.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      );
    case "workout_template":
      return hasRow(
        client
          .select({ id: workoutTemplates.id })
          .from(workoutTemplates)
          .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)))
      );
  }
}

async function hasRow(query: PromiseLike<unknown[]>): Promise<boolean> {
  return (await query).length > 0;
}

/** Convenience wrapper for checks that are not part of a larger transaction. */
export function isOwned(
  relationship: OwnedRelationship,
  id: string,
  userId: string
): Promise<boolean> {
  return isOwnedRelationship(db, relationship, id, userId);
}

/**
 * Assignment is stricter than ownership: terminal parents remain readable so
 * historical relationships render, but cannot receive new children.
 */
export async function isAssignableRelationship(
  client: OwnershipClient,
  relationship: "space" | "goal",
  id: string,
  userId: string
): Promise<boolean> {
  if (relationship === "space") {
    return hasRow(
      client
        .select({ id: spaces.id })
        .from(spaces)
        .where(
          and(
            eq(spaces.id, id),
            eq(spaces.userId, userId),
            // Paused spaces intentionally remain assignable.
            inArray(spaces.status, ["active", "paused"])
          )
        )
    );
  }
  return hasRow(
    client
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId), eq(goals.status, "active")))
  );
}
