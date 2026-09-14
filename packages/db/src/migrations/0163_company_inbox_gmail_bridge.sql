ALTER TABLE "company_inbox_connectors" ADD COLUMN IF NOT EXISTS "credential_secret_id" uuid;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN IF NOT EXISTS "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD COLUMN IF NOT EXISTS "approval_id" uuid;
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD COLUMN IF NOT EXISTS "provider_operation_id" text;
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD COLUMN IF NOT EXISTS "last_error" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "company_secrets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" DROP CONSTRAINT IF EXISTS "company_inbox_messages_status_check";
--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_status_check" CHECK ("status" in ('unread', 'read', 'draft', 'pending_approval', 'executing', 'sent', 'failed', 'outcome_unknown', 'archived'));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_inbox_messages_connector_approval_uq" ON "company_inbox_messages" ("connector_id", "approval_id") WHERE "approval_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_inbox_messages_connector_provider_operation_uq" ON "company_inbox_messages" ("connector_id", "provider_operation_id") WHERE "provider_operation_id" is not null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_inbox_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "connector_id" uuid NOT NULL,
  "message_id" uuid,
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
  CONSTRAINT "company_inbox_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'message_received', 'reply_drafted', 'reply_requested', 'reply_reserved', 'reply_submitted', 'reply_failed', 'revoked'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_connector_id_company_inbox_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "company_inbox_connectors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_message_id_company_inbox_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "company_inbox_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_receipts_company_occurred_idx" ON "company_inbox_receipts" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_inbox_receipts_connector_occurred_idx" ON "company_inbox_receipts" ("connector_id", "occurred_at");
