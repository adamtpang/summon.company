CREATE TABLE "company_website_environment_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"key" text NOT NULL,
	"secret_id" uuid NOT NULL,
	"targets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_environment_id" text,
	"applied_secret_version" integer,
	"last_applied_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_website_environment_variables_status_check" CHECK ("status" in ('pending', 'applied', 'error'))
);
--> statement-breakpoint
ALTER TABLE "company_website_environment_variables" ADD CONSTRAINT "company_website_environment_variables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_website_environment_variables" ADD CONSTRAINT "company_website_environment_variables_website_id_company_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."company_websites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_website_environment_variables" ADD CONSTRAINT "company_website_environment_variables_secret_id_company_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_website_environment_variables_website_key_uq" ON "company_website_environment_variables" USING btree ("website_id","key");
--> statement-breakpoint
CREATE INDEX "company_website_environment_variables_website_status_idx" ON "company_website_environment_variables" USING btree ("website_id","status");
--> statement-breakpoint
CREATE INDEX "company_website_environment_variables_company_idx" ON "company_website_environment_variables" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "company_website_receipts" DROP CONSTRAINT IF EXISTS "company_website_receipts_type_check";
--> statement-breakpoint
ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_type_check" CHECK ("type" in ('connected', 'deployment_requested', 'deployment_reported', 'redeployment_reported', 'rollback_reported', 'promotion_reported', 'domain_reported', 'health_checked', 'environment_applied', 'revoked'));
