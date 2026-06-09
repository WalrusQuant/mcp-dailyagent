ALTER TABLE "daily_briefings" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_briefings" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "insight_cache" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "timezone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
-- Dedupe before the unique index: pre-0004 databases may hold several journal
-- entries on one (user_id, entry_date); keep the most recently updated row.
-- Safe to add post-release: drizzle's migrator skips already-applied
-- migrations by timestamp, so only fresh installs and pre-0004 upgrades run
-- this file.
DELETE FROM "journal_entries" a
USING "journal_entries" b
WHERE a."user_id" = b."user_id"
  AND a."entry_date" = b."entry_date"
  AND a."id" <> b."id"
  AND (a."updated_at" < b."updated_at" OR (a."updated_at" = b."updated_at" AND a."id" < b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_user_date_unique" ON "journal_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "idx_workout_logs_template" ON "workout_logs" USING btree ("template_id");