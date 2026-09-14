CREATE TABLE IF NOT EXISTS "company_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"external_project_id" text NOT NULL,
	"display_name" text NOT NULL,
	"production_url" text NOT NULL,
	"custom_domain" text,
	"owner_agent_id" uuid,
	"credential_secret_id" uuid,
	"provider_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connection_status" text DEFAULT 'connected' NOT NULL,
	"deploy_authority" text DEFAULT 'approval_required' NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deployment_status" text DEFAULT 'idle' NOT NULL,
	"last_deployment_id" text,
	"last_deployment_version" text,
	"last_deployment_url" text,
	"deployment_started_at" timestamp with time zone,
	"deployed_at" timestamp with time zone,
	"domain_status" text DEFAULT 'not_configured' NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"last_http_status" integer,
	"last_response_time_ms" integer,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_websites_connection_status_check" CHECK ("connection_status" in ('connected', 'error', 'revoked')),
	CONSTRAINT "company_websites_deploy_authority_check" CHECK ("deploy_authority" in ('observe_only', 'approval_required')),
	CONSTRAINT "company_websites_deployment_status_check" CHECK ("deployment_status" in ('idle', 'queued', 'building', 'ready', 'failed', 'cancelled')),
	CONSTRAINT "company_websites_domain_status_check" CHECK ("domain_status" in ('not_configured', 'pending', 'verified', 'error')),
	CONSTRAINT "company_websites_health_status_check" CHECK ("health_status" in ('unknown', 'healthy', 'degraded', 'down'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_website_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_id" uuid,
	"provider_operation_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_website_receipts_type_check" CHECK ("type" in ('connected', 'deployment_requested', 'deployment_reported', 'domain_reported', 'health_checked', 'revoked'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_websites" ADD CONSTRAINT "company_websites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_websites" ADD CONSTRAINT "company_websites_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_websites" ADD CONSTRAINT "company_websites_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "company_secrets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_website_id_company_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "company_websites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_website_receipts" ADD CONSTRAINT "company_website_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_websites_company_status_idx" ON "company_websites" ("company_id", "connection_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_websites_provider_project_uq" ON "company_websites" ("company_id", "provider_key", "external_project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_website_receipts_company_occurred_idx" ON "company_website_receipts" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_website_receipts_website_occurred_idx" ON "company_website_receipts" ("website_id", "occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_website_receipts_website_approval_execution_uq" ON "company_website_receipts" ("website_id", "approval_id") WHERE "type" = 'deployment_reported' and "approval_id" is not null;
