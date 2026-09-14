ALTER TABLE "company_website_receipts" DROP CONSTRAINT IF EXISTS "company_website_receipts_type_check";
--> statement-breakpoint
ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_type_check" CHECK ("type" in ('connected', 'deployment_requested', 'deployment_reported', 'redeployment_reported', 'rollback_reported', 'promotion_reported', 'domain_reported', 'health_checked', 'revoked'));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_website_receipts_website_rollback_request_uq" ON "company_website_receipts" ("website_id", "provider_operation_id") WHERE "type" = 'rollback_reported' and "provider_operation_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_website_receipts_website_redeploy_request_uq" ON "company_website_receipts" ("website_id", "provider_operation_id") WHERE "type" = 'redeployment_reported' and "provider_operation_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_website_receipts_website_promotion_request_uq" ON "company_website_receipts" ("website_id", "provider_operation_id") WHERE "type" = 'promotion_reported' and "provider_operation_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_website_receipts_website_production_mutation_executing_uq" ON "company_website_receipts" ("website_id") WHERE "type" in ('rollback_reported', 'redeployment_reported', 'promotion_reported') and "status" = 'executing';
