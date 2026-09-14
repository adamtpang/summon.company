ALTER TABLE "company_payment_accounts" ADD COLUMN "webhook_public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "webhook_signing_secret_id" uuid;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "webhook_status" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "webhook_configured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "last_webhook_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "last_webhook_error" text;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_webhook_signing_secret_id_company_secrets_id_fk" FOREIGN KEY ("webhook_signing_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_webhook_status_check" CHECK ("webhook_status" in ('unconfigured', 'active', 'error', 'revoked'));--> statement-breakpoint
CREATE UNIQUE INDEX "company_payment_accounts_webhook_public_id_uq" ON "company_payment_accounts" USING btree ("webhook_public_id");--> statement-breakpoint
ALTER TABLE "company_payment_receipts" DROP CONSTRAINT "company_payment_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'revoked'));--> statement-breakpoint
CREATE UNIQUE INDEX "company_payment_receipts_checkout_session_type_uq" ON "company_payment_receipts" USING btree ("account_id","type","provider_operation_id") WHERE "provider_operation_id" is not null and "type" in ('checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped');--> statement-breakpoint
CREATE UNIQUE INDEX "issues_customer_payment_origin_uq" ON "issues" USING btree ("company_id","origin_kind","origin_id") WHERE "origin_kind" = 'customer_payment' and "origin_id" is not null;
