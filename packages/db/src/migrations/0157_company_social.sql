CREATE TABLE IF NOT EXISTS "company_social_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"external_profile_id" text NOT NULL,
	"display_name" text NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"credential_secret_id" uuid,
	"connection_status" text DEFAULT 'connected' NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_social_connections_status_check" CHECK ("connection_status" in ('connected', 'error', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_social_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"platform" text NOT NULL,
	"username" text,
	"display_name" text NOT NULL,
	"profile_url" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_social_channels_status_check" CHECK ("status" in ('connected', 'disconnected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"target_channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_post_id" text,
	"platform_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_id" uuid,
	"provider_operation_id" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_social_posts_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'submitted', 'scheduled', 'published', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_social_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"post_id" uuid,
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
	CONSTRAINT "company_social_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'revoked'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_connections" ADD CONSTRAINT "company_social_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_connections" ADD CONSTRAINT "company_social_connections_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_connections" ADD CONSTRAINT "company_social_connections_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "company_secrets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_channels" ADD CONSTRAINT "company_social_channels_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_channels" ADD CONSTRAINT "company_social_channels_connection_id_company_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_social_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_connection_id_company_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_social_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_connection_id_company_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_social_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_post_id_company_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "company_social_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_connections_company_status_idx" ON "company_social_connections" ("company_id", "connection_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_social_connections_provider_profile_uq" ON "company_social_connections" ("company_id", "provider_key", "external_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_channels_connection_status_idx" ON "company_social_channels" ("connection_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_channels_company_platform_idx" ON "company_social_channels" ("company_id", "platform");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_social_channels_connection_account_uq" ON "company_social_channels" ("connection_id", "provider_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_posts_connection_created_idx" ON "company_social_posts" ("connection_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_posts_company_status_idx" ON "company_social_posts" ("company_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_social_posts_connection_external_post_uq" ON "company_social_posts" ("connection_id", "external_post_id") WHERE "external_post_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_social_posts_connection_approval_uq" ON "company_social_posts" ("connection_id", "approval_id") WHERE "approval_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_receipts_company_occurred_idx" ON "company_social_receipts" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_social_receipts_connection_occurred_idx" ON "company_social_receipts" ("connection_id", "occurred_at");
