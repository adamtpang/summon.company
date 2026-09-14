CREATE TABLE IF NOT EXISTS "company_outreach_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "provider_key" text NOT NULL,
  "external_server_id" text NOT NULL, "display_name" text NOT NULL, "from_name" text NOT NULL, "from_email" text NOT NULL,
  "reply_to_email" text NOT NULL, "message_stream" text NOT NULL, "opt_out_footer" text NOT NULL, "inbox_connector_id" uuid NOT NULL,
  "owner_agent_id" uuid NOT NULL, "credential_secret_id" uuid, "status" text DEFAULT 'connected' NOT NULL,
  "granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL, "daily_send_limit" integer DEFAULT 10 NOT NULL,
  "policy_version" text DEFAULT 'permission-based-v1' NOT NULL, "last_synced_at" timestamp with time zone, "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL, "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_connections_status_check" CHECK ("status" in ('connected', 'error', 'revoked')),
  CONSTRAINT "company_outreach_connections_daily_limit_check" CHECK ("daily_send_limit" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "email" text NOT NULL, "name" text NOT NULL,
  "company_name" text NOT NULL, "title" text, "source_label" text NOT NULL, "source_url" text, "contact_basis" text NOT NULL,
  "basis_evidence" text NOT NULL, "status" text DEFAULT 'eligible' NOT NULL, "verified_at" timestamp with time zone NOT NULL,
  "last_contacted_at" timestamp with time zone, "replied_at" timestamp with time zone, "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_leads_status_check" CHECK ("status" in ('eligible', 'suppressed', 'replied', 'bounced')),
  CONSTRAINT "company_outreach_leads_basis_check" CHECK ("contact_basis" in ('explicit_opt_in', 'existing_customer', 'direct_business_request'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "connection_id" uuid NOT NULL,
  "name" text NOT NULL, "objective" text NOT NULL, "status" text DEFAULT 'active' NOT NULL, "daily_send_limit" integer DEFAULT 10 NOT NULL,
  "max_follow_ups" integer DEFAULT 1 NOT NULL, "created_by_agent_id" uuid, "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_campaigns_status_check" CHECK ("status" in ('draft', 'active', 'paused', 'completed')),
  CONSTRAINT "company_outreach_campaigns_limits_check" CHECK ("daily_send_limit" between 1 and 20 and "max_follow_ups" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "connection_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL, "lead_id" uuid NOT NULL, "sequence_number" integer DEFAULT 0 NOT NULL, "subject" text NOT NULL,
  "body" text NOT NULL, "status" text NOT NULL, "recipient_snapshot" jsonb NOT NULL, "approval_id" uuid,
  "provider_message_id" text, "provider_operation_id" text, "created_by_agent_id" uuid, "created_by_user_id" text,
  "submitted_at" timestamp with time zone, "delivered_at" timestamp with time zone, "replied_at" timestamp with time zone,
  "last_error" text, "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_messages_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'submitted', 'delivered', 'bounced', 'replied', 'failed', 'cancelled')),
  CONSTRAINT "company_outreach_messages_sequence_check" CHECK ("sequence_number" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "normalized_email" text NOT NULL,
  "reason" text NOT NULL, "source" text NOT NULL, "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL, "created_by_agent_id" uuid, "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_suppressions_reason_check" CHECK ("reason" in ('opt_out', 'hard_bounce', 'complaint', 'manual', 'reply_received'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "company_id" uuid NOT NULL, "connection_id" uuid NOT NULL,
  "campaign_id" uuid, "lead_id" uuid, "message_id" uuid, "type" text NOT NULL, "status" text NOT NULL, "summary" text NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL, "approval_id" uuid, "provider_operation_id" text, "provider_event_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL, "created_by_agent_id" uuid, "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_receipts_type_check" CHECK ("type" in ('connected', 'campaign_created', 'lead_added', 'message_requested', 'message_submitted', 'message_delivered', 'message_bounced', 'reply_received', 'suppressed', 'revoked'))
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_inbox_connector_id_company_inbox_connectors_id_fk" FOREIGN KEY ("inbox_connector_id") REFERENCES "company_inbox_connectors"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "agents"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "company_secrets"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_leads" ADD CONSTRAINT "company_outreach_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_connection_id_company_outreach_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_outreach_connections"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_connection_id_company_outreach_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_outreach_connections"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_campaign_id_company_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "company_outreach_campaigns"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_lead_id_company_outreach_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "company_outreach_leads"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_messages" ADD CONSTRAINT "company_outreach_messages_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_suppressions" ADD CONSTRAINT "company_outreach_suppressions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_suppressions" ADD CONSTRAINT "company_outreach_suppressions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_connection_id_company_outreach_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_outreach_connections"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_campaign_id_company_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "company_outreach_campaigns"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_lead_id_company_outreach_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "company_outreach_leads"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_message_id_company_outreach_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "company_outreach_messages"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_connections_company_status_idx" ON "company_outreach_connections" ("company_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_connections_provider_server_uq" ON "company_outreach_connections" ("company_id", "provider_key", "external_server_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_leads_company_email_uq" ON "company_outreach_leads" ("company_id", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_leads_company_status_idx" ON "company_outreach_leads" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_campaigns_company_status_idx" ON "company_outreach_campaigns" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_campaigns_connection_created_idx" ON "company_outreach_campaigns" ("connection_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_messages_company_status_idx" ON "company_outreach_messages" ("company_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_messages_campaign_created_idx" ON "company_outreach_messages" ("campaign_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_messages_campaign_lead_sequence_uq" ON "company_outreach_messages" ("campaign_id", "lead_id", "sequence_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_messages_connection_approval_uq" ON "company_outreach_messages" ("connection_id", "approval_id") WHERE "approval_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_messages_connection_provider_message_uq" ON "company_outreach_messages" ("connection_id", "provider_message_id") WHERE "provider_message_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_suppressions_company_email_uq" ON "company_outreach_suppressions" ("company_id", "normalized_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_suppressions_company_occurred_idx" ON "company_outreach_suppressions" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_receipts_company_occurred_idx" ON "company_outreach_receipts" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_receipts_connection_occurred_idx" ON "company_outreach_receipts" ("connection_id", "occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_receipts_connection_provider_event_uq" ON "company_outreach_receipts" ("connection_id", "provider_event_id") WHERE "provider_event_id" is not null;
