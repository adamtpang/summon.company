CREATE TABLE IF NOT EXISTS "company_payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"credential_secret_id" uuid,
	"connection_status" text DEFAULT 'connected' NOT NULL,
	"mode" text NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"country" text,
	"default_currency" text,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recent_payment_count" integer DEFAULT 0 NOT NULL,
	"recent_gross_cents" bigint DEFAULT 0 NOT NULL,
	"recent_currency" text,
	"active_subscription_count" integer DEFAULT 0 NOT NULL,
	"last_payment_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_payment_accounts_connection_status_check" CHECK ("connection_status" in ('connected', 'error', 'revoked')),
	CONSTRAINT "company_payment_accounts_mode_check" CHECK ("mode" in ('test', 'live')),
	CONSTRAINT "company_payment_accounts_nonnegative_metrics_check" CHECK ("recent_payment_count" >= 0 and "recent_gross_cents" >= 0 and "active_subscription_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_payment_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"interval" text,
	"allow_promotion_codes" boolean DEFAULT false NOT NULL,
	"automatic_tax" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"external_product_id" text,
	"external_price_id" text,
	"external_payment_link_id" text,
	"payment_url" text,
	"approval_id" uuid,
	"provider_operation_id" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"activated_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_payment_offers_kind_check" CHECK ("kind" in ('one_time', 'subscription')),
	CONSTRAINT "company_payment_offers_interval_check" CHECK (("kind" = 'one_time' and "interval" is null) or ("kind" = 'subscription' and "interval" in ('month', 'year'))),
	CONSTRAINT "company_payment_offers_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'active', 'inactive', 'failed')),
	CONSTRAINT "company_payment_offers_amount_check" CHECK ("unit_amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"offer_id" uuid,
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
	CONSTRAINT "company_payment_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_deactivated', 'revoked'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "company_secrets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_offers" ADD CONSTRAINT "company_payment_offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_offers" ADD CONSTRAINT "company_payment_offers_account_id_company_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "company_payment_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_offers" ADD CONSTRAINT "company_payment_offers_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_offers" ADD CONSTRAINT "company_payment_offers_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_account_id_company_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "company_payment_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_offer_id_company_payment_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "company_payment_offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payment_accounts_company_status_idx" ON "company_payment_accounts" ("company_id", "connection_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_payment_accounts_provider_account_uq" ON "company_payment_accounts" ("company_id", "provider_key", "external_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payment_offers_company_created_idx" ON "company_payment_offers" ("company_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payment_offers_account_status_idx" ON "company_payment_offers" ("account_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_payment_offers_account_payment_link_uq" ON "company_payment_offers" ("account_id", "external_payment_link_id") WHERE "external_payment_link_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_payment_offers_account_approval_uq" ON "company_payment_offers" ("account_id", "approval_id") WHERE "approval_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payment_receipts_company_occurred_idx" ON "company_payment_receipts" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_payment_receipts_account_occurred_idx" ON "company_payment_receipts" ("account_id", "occurred_at");
