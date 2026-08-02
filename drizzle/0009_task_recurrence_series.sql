CREATE TABLE IF NOT EXISTS "task_recurrence_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rule" jsonb NOT NULL,
	"anchor_date" date NOT NULL,
	"ends_before" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrence_series_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_date" date;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_recurrence_series" ADD CONSTRAINT "task_recurrence_series_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_series_id_task_recurrence_series_id_fk" FOREIGN KEY ("recurrence_series_id") REFERENCES "public"."task_recurrence_series"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "task_recurrence_series" ("id", "user_id", "rule", "anchor_date", "created_at", "updated_at")
SELECT "id", "user_id", "recurrence", "task_date", "created_at", "updated_at"
FROM "tasks"
WHERE "recurrence" IS NOT NULL
  AND "recurrence_series_id" IS NULL
  AND jsonb_typeof("recurrence") = 'object'
  AND (
    ("recurrence"->>'type' IN ('daily', 'weekdays', 'monthly')
      AND "recurrence" = jsonb_build_object('type', "recurrence"->>'type'))
    OR
    ("recurrence"->>'type' = 'weekly'
      AND ("recurrence" - 'days') = jsonb_build_object('type', 'weekly')
      AND (
        NOT ("recurrence" ? 'days')
        OR CASE WHEN jsonb_typeof("recurrence"->'days') = 'array' THEN
          jsonb_array_length("recurrence"->'days') > 0
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements("recurrence"->'days') AS day(value)
            WHERE CASE WHEN jsonb_typeof(day.value) = 'number' THEN
              (day.value #>> '{}')::numeric <> trunc((day.value #>> '{}')::numeric)
              OR (day.value #>> '{}')::int NOT BETWEEN 1 AND 7
            ELSE true END
          )
          AND jsonb_array_length("recurrence"->'days') = (
            SELECT count(DISTINCT day.value) FROM jsonb_array_elements("recurrence"->'days') AS day(value)
          )
        ELSE false END
      ))
  )
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "tasks"
SET "recurrence_series_id" = "id", "scheduled_date" = "task_date"
WHERE "recurrence" IS NOT NULL
  AND "recurrence_series_id" IS NULL
  AND EXISTS (SELECT 1 FROM "task_recurrence_series" s WHERE s."id" = "tasks"."id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_recurrence_series_user" ON "task_recurrence_series" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_recurrence_series_scheduled_unique" ON "tasks" USING btree ("recurrence_series_id", "scheduled_date");
