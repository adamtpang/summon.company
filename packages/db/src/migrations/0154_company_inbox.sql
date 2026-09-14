CREATE TABLE IF NOT EXISTS "company_inbox_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"channel_type" text NOT NULL,
	"account_label" text,
	"owner_agent_id" uuid,
	"status" text DEFAULT 'connected' NOT NULL,
	"reply_authority" text DEFAULT 'draft_only' NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"last_error" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_inbox_connectors_channel_type_check" CHECK ("channel_type" in ('email', 'chat', 'social', 'support', 'custom')),
	CONSTRAINT "company_inbox_connectors_status_check" CHECK ("status" in ('connected', 'error', 'revoked')),
	CONSTRAINT "company_inbox_connectors_reply_authority_check" CHECK ("reply_authority" in ('none', 'draft_only', 'approval_required'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"external_thread_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"sender_name" text,
	"sender_address" text,
	"recipient_name" text,
	"recipient_address" text,
	"subject" text,
	"body" text NOT NULL,
	"in_reply_to_external_message_id" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_inbox_messages_direction_check" CHECK ("direction" in ('inbound', 'outbound')),
	CONSTRAINT "company_inbox_messages_status_check" CHECK ("status" in ('unread', 'read', 'draft', 'pending_approval', 'sent', 'failed', 'archived'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_connector_id_company_inbox_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "company_inbox_connectors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_connectors_company_status_idx" ON "company_inbox_connectors" ("company_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_inbox_connectors_provider_account_uq" ON "company_inbox_connectors" ("company_id", "provider_key", "external_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_messages_company_occurred_idx" ON "company_inbox_messages" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_messages_company_status_idx" ON "company_inbox_messages" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_messages_connector_thread_idx" ON "company_inbox_messages" ("connector_id", "external_thread_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_inbox_messages_connector_external_message_uq" ON "company_inbox_messages" ("connector_id", "external_message_id");
