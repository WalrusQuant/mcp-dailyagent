DROP INDEX "idx_focus_sessions_user";--> statement-breakpoint
DROP INDEX "idx_habit_logs_habit_date";--> statement-breakpoint
DROP INDEX "idx_journal_user_date";--> statement-breakpoint
DROP INDEX "idx_spaces_user";--> statement-breakpoint
CREATE INDEX "idx_tasks_rolled_from" ON "tasks" USING btree ("rolled_from");