ALTER TABLE "company_mobile_apps" ADD COLUMN "webhook_public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "webhook_signing_secret_id" uuid;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "webhook_status" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "webhook_configured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "last_webhook_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "last_webhook_error" text;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_webhook_signing_secret_id_company_secrets_id_fk" FOREIGN KEY ("webhook_signing_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_webhook_status_check" CHECK ("webhook_status" in ('unconfigured', 'active', 'error', 'revoked'));--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_apps_webhook_public_id_uq" ON "company_mobile_apps" USING btree ("webhook_public_id");--> statement-breakpoint

ALTER TABLE "company_mobile_receipts" DROP CONSTRAINT "company_mobile_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_type_check" CHECK ("type" in ('configured', 'source_planned', 'source_publish_started', 'source_published', 'source_publish_failed', 'build_dispatch_started', 'build_dispatched', 'build_refreshed', 'build_succeeded', 'build_failed', 'build_outcome_unknown', 'build_reconciled', 'webhook_configured', 'build_evidence_received', 'revoked'));--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_receipts_artifact_provider_operation_uq" ON "company_mobile_receipts" USING btree ("mobile_app_id","provider_operation_id") WHERE "type" = 'build_evidence_received' and "provider_operation_id" is not null;
