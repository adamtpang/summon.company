ALTER TABLE "company_social_posts" ADD COLUMN "analytics" jsonb;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "analytics_status" text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "analytics_last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "analytics_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "analytics_next_refresh_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "analytics_last_error" text;--> statement-breakpoint
CREATE INDEX "company_social_posts_analytics_due_idx" ON "company_social_posts" USING btree ("analytics_status","analytics_next_refresh_at");--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_analytics_status_check" CHECK ("analytics_status" in ('not_requested', 'pending', 'fresh', 'unavailable', 'error'));--> statement-breakpoint
ALTER TABLE "company_social_receipts" DROP CONSTRAINT IF EXISTS "company_social_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'post_delete_requested', 'post_deleted', 'post_delete_failed', 'post_delete_outcome_unknown', 'post_delete_reconciled', 'post_reconciled', 'post_webhook_reconciled', 'post_analytics_refreshed', 'webhook_verified', 'revoked'));
