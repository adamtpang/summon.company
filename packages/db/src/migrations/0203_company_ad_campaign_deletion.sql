ALTER TABLE "company_ad_campaigns" ADD COLUMN "delete_request_id" uuid;--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD COLUMN "delete_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "company_ad_campaigns_connection_delete_request_uq" ON "company_ad_campaigns" USING btree ("connection_id","delete_request_id") WHERE "delete_request_id" is not null;--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" DROP CONSTRAINT IF EXISTS "company_ad_campaigns_status_check";--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_status_check" CHECK ("status" in ('awaiting_approval', 'provisioning', 'active', 'paused', 'completed', 'deleting', 'deleted', 'deletion_outcome_unknown', 'outcome_unknown', 'failed'));--> statement-breakpoint
ALTER TABLE "company_ad_receipts" DROP CONSTRAINT IF EXISTS "company_ad_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'campaign_requested', 'campaign_launched', 'campaign_paused', 'campaign_resumed', 'campaign_completed', 'campaign_delete_requested', 'campaign_deleted', 'campaign_delete_failed', 'campaign_delete_outcome_unknown', 'campaign_delete_reconciled', 'campaign_failed', 'revoked'));
