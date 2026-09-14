ALTER TABLE "company_outreach_connections" ADD COLUMN "webhook_auth_hash" text;
ALTER TABLE "company_outreach_connections" ADD COLUMN "provider_webhook_id" text;
ALTER TABLE "company_outreach_connections" ADD COLUMN "webhook_status" text DEFAULT 'unconfigured' NOT NULL;
ALTER TABLE "company_outreach_connections" ADD COLUMN "webhook_verified_at" timestamp with time zone;
ALTER TABLE "company_outreach_connections" ADD COLUMN "webhook_last_event_at" timestamp with time zone;
ALTER TABLE "company_outreach_connections" ADD COLUMN "webhook_last_error" text;
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_webhook_status_check" CHECK ("webhook_status" in ('unconfigured', 'provisioning', 'verified', 'error', 'revoked'));
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_webhook_auth_hash_check" CHECK ("webhook_auth_hash" is null or (length("webhook_auth_hash") = 64 and "webhook_auth_hash" ~ '^[0-9a-f]{64}$'));
CREATE UNIQUE INDEX "company_outreach_connections_provider_webhook_uq" ON "company_outreach_connections" USING btree ("company_id", "provider_key", "provider_webhook_id") WHERE "provider_webhook_id" is not null;
