-- Backfill any NULL target_days before tightening the constraint: the column
-- has always had a default, but explicit NULL writes were possible pre-fix.
UPDATE "habits" SET "target_days" = '{1,2,3,4,5,6,7}' WHERE "target_days" IS NULL;--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "target_days" SET NOT NULL;
