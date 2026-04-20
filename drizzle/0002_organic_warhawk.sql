ALTER TABLE "daily_briefings" DROP CONSTRAINT "daily_briefings_source_check";--> statement-breakpoint
ALTER TABLE "insight_cache" DROP CONSTRAINT "insight_cache_source_check";--> statement-breakpoint
ALTER TABLE "weekly_reviews" DROP CONSTRAINT "weekly_reviews_source_check";--> statement-breakpoint
ALTER TABLE "daily_briefings" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "insight_cache" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "weekly_reviews" DROP COLUMN "source";