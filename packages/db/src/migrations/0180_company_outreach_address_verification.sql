ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_provider_key" text DEFAULT 'hunter' NOT NULL;
ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_credential_secret_id" uuid;
ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_status" text DEFAULT 'unconfigured' NOT NULL;
ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_requests_remaining" integer;
ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_last_synced_at" timestamp with time zone;
ALTER TABLE "company_outreach_connections" ADD COLUMN "verification_last_error" text;
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_verification_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("verification_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_verification_provider_check" CHECK ("verification_provider_key" = 'hunter');
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_verification_status_check" CHECK ("verification_status" in ('unconfigured', 'ready', 'exhausted', 'error', 'revoked'));
ALTER TABLE "company_outreach_connections" ADD CONSTRAINT "company_outreach_connections_verification_remaining_check" CHECK ("verification_requests_remaining" is null or "verification_requests_remaining" >= 0);

ALTER TABLE "company_outreach_leads" ADD COLUMN "address_verification_status" text DEFAULT 'unverified' NOT NULL;
ALTER TABLE "company_outreach_leads" ADD COLUMN "address_verification_score" integer;
ALTER TABLE "company_outreach_leads" ADD COLUMN "address_verified_at" timestamp with time zone;
ALTER TABLE "company_outreach_leads" ADD COLUMN "address_verification_last_error" text;
ALTER TABLE "company_outreach_leads" DROP CONSTRAINT "company_outreach_leads_status_check";
UPDATE "company_outreach_leads" SET "status" = 'verification_required' WHERE "status" = 'eligible';
ALTER TABLE "company_outreach_leads" ALTER COLUMN "status" SET DEFAULT 'verification_required';
ALTER TABLE "company_outreach_leads" ADD CONSTRAINT "company_outreach_leads_status_check" CHECK ("status" in ('verification_required', 'verification_pending', 'eligible', 'suppressed', 'replied', 'bounced'));
ALTER TABLE "company_outreach_leads" ADD CONSTRAINT "company_outreach_leads_verification_status_check" CHECK ("address_verification_status" in ('unverified', 'pending', 'valid', 'accept_all', 'webmail', 'disposable', 'invalid', 'unknown', 'privacy_claimed', 'error'));
ALTER TABLE "company_outreach_leads" ADD CONSTRAINT "company_outreach_leads_verification_score_check" CHECK ("address_verification_score" is null or "address_verification_score" between 0 and 100);

ALTER TABLE "company_outreach_suppressions" DROP CONSTRAINT "company_outreach_suppressions_reason_check";
ALTER TABLE "company_outreach_suppressions" ADD CONSTRAINT "company_outreach_suppressions_reason_check" CHECK ("reason" in ('opt_out', 'hard_bounce', 'complaint', 'manual', 'reply_received', 'invalid_address', 'disposable_address', 'verification_privacy_request'));
ALTER TABLE "company_outreach_receipts" DROP CONSTRAINT "company_outreach_receipts_type_check";
ALTER TABLE "company_outreach_receipts" ADD CONSTRAINT "company_outreach_receipts_type_check" CHECK ("type" in ('connected', 'campaign_created', 'lead_added', 'lead_verified', 'message_requested', 'message_submitted', 'message_delivered', 'message_bounced', 'reply_received', 'suppressed', 'revoked'));
