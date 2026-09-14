ALTER TABLE "company_outreach_connections" ADD COLUMN IF NOT EXISTS "unsubscribe_base_url" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_outreach_unsubscribe_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "lead_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_outreach_unsubscribe_tokens_hash_check" CHECK (length("token_hash") = 64 and "token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_unsubscribe_tokens" ADD CONSTRAINT "company_outreach_unsubscribe_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_unsubscribe_tokens" ADD CONSTRAINT "company_outreach_unsubscribe_tokens_connection_id_company_outreach_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "company_outreach_connections"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_unsubscribe_tokens" ADD CONSTRAINT "company_outreach_unsubscribe_tokens_lead_id_company_outreach_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "company_outreach_leads"("id") ON DELETE restrict; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_outreach_unsubscribe_tokens" ADD CONSTRAINT "company_outreach_unsubscribe_tokens_message_id_company_outreach_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "company_outreach_messages"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_unsubscribe_tokens_message_uq" ON "company_outreach_unsubscribe_tokens" ("message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_outreach_unsubscribe_tokens_token_hash_uq" ON "company_outreach_unsubscribe_tokens" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_outreach_unsubscribe_tokens_company_created_idx" ON "company_outreach_unsubscribe_tokens" ("company_id", "created_at");
