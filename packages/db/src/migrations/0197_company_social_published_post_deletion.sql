ALTER TABLE "company_social_posts" ADD COLUMN "delete_request_id" uuid;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "delete_previous_status" text;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "delete_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "company_social_posts_connection_delete_request_uq" ON "company_social_posts" USING btree ("connection_id","delete_request_id") WHERE "delete_request_id" is not null;--> statement-breakpoint
ALTER TABLE "company_social_posts" DROP CONSTRAINT IF EXISTS "company_social_posts_status_check";--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'submitted', 'scheduled', 'published', 'partial', 'deleting', 'deleted', 'deletion_outcome_unknown', 'failed', 'cancelled', 'outcome_unknown'));--> statement-breakpoint
ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_delete_previous_status_check" CHECK ("delete_previous_status" is null or "delete_previous_status" in ('published', 'partial'));--> statement-breakpoint
ALTER TABLE "company_social_receipts" DROP CONSTRAINT IF EXISTS "company_social_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'post_delete_requested', 'post_deleted', 'post_delete_failed', 'post_delete_outcome_unknown', 'post_delete_reconciled', 'post_reconciled', 'post_webhook_reconciled', 'webhook_verified', 'revoked'));
