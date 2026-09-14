ALTER TABLE "company_social_connections" ADD COLUMN "webhook_secret_id" uuid;
ALTER TABLE "company_social_connections" ADD COLUMN "provider_webhook_id" text;
ALTER TABLE "company_social_connections" ADD COLUMN "webhook_status" text DEFAULT 'unconfigured' NOT NULL;
ALTER TABLE "company_social_connections" ADD COLUMN "webhook_verified_at" timestamp with time zone;
ALTER TABLE "company_social_connections" ADD COLUMN "webhook_last_event_at" timestamp with time zone;
ALTER TABLE "company_social_connections" ADD COLUMN "webhook_last_error" text;
ALTER TABLE "company_social_connections" ADD CONSTRAINT "company_social_connections_webhook_secret_id_company_secrets_id_fk" FOREIGN KEY ("webhook_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "company_social_connections" ADD CONSTRAINT "company_social_connections_webhook_status_check" CHECK ("webhook_status" in ('unconfigured', 'provisioning', 'verified', 'error', 'revoked'));
CREATE UNIQUE INDEX "company_social_connections_provider_webhook_uq" ON "company_social_connections" USING btree ("company_id", "provider_key", "provider_webhook_id") WHERE "provider_webhook_id" is not null;

ALTER TABLE "company_social_posts" DROP CONSTRAINT IF EXISTS "company_social_posts_status_check";
ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'submitted', 'scheduled', 'published', 'partial', 'failed', 'cancelled', 'outcome_unknown'));

ALTER TABLE "company_social_receipts" ADD COLUMN "provider_event_id" text;
ALTER TABLE "company_social_receipts" DROP CONSTRAINT IF EXISTS "company_social_receipts_type_check";
ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'post_reconciled', 'post_webhook_reconciled', 'webhook_verified', 'revoked'));
CREATE UNIQUE INDEX "company_social_receipts_connection_provider_event_uq" ON "company_social_receipts" USING btree ("connection_id", "provider_event_id") WHERE "provider_event_id" is not null;

CREATE TABLE "company_social_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_event_type" text NOT NULL,
	"provider_post_id" text,
	"local_post_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_social_webhook_events_status_check" CHECK ("status" in ('pending', 'processing', 'retrying', 'processed', 'ignored', 'failed')),
	CONSTRAINT "company_social_webhook_events_attempts_check" CHECK ("attempts" >= 0)
);
ALTER TABLE "company_social_webhook_events" ADD CONSTRAINT "company_social_webhook_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "company_social_webhook_events" ADD CONSTRAINT "company_social_webhook_events_connection_id_company_social_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."company_social_connections"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "company_social_webhook_events_connection_event_uq" ON "company_social_webhook_events" USING btree ("connection_id", "provider_event_id");
CREATE INDEX "company_social_webhook_events_due_idx" ON "company_social_webhook_events" USING btree ("status", "next_attempt_at");
CREATE INDEX "company_social_webhook_events_company_occurred_idx" ON "company_social_webhook_events" USING btree ("company_id", "occurred_at");
