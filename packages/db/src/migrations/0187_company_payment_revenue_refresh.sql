ALTER TABLE "company_payment_accounts"
  ADD COLUMN "revenue_sync_status" text DEFAULT 'idle' NOT NULL,
  ADD COLUMN "next_revenue_sync_at" timestamp with time zone DEFAULT now(),
  ADD COLUMN "revenue_sync_started_at" timestamp with time zone,
  ADD COLUMN "revenue_sync_failure_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "last_revenue_sync_error" text,
  ADD COLUMN "revenue_snapshot_fingerprint" text;

UPDATE "company_payment_accounts"
SET
  "revenue_sync_status" = 'revoked',
  "next_revenue_sync_at" = NULL
WHERE "connection_status" = 'revoked';

ALTER TABLE "company_payment_accounts"
  ADD CONSTRAINT "company_payment_accounts_revenue_sync_status_check"
    CHECK ("revenue_sync_status" in ('idle', 'processing', 'retrying', 'error', 'revoked')),
  ADD CONSTRAINT "company_payment_accounts_revenue_sync_failure_count_check"
    CHECK ("revenue_sync_failure_count" >= 0),
  ADD CONSTRAINT "company_payment_accounts_revenue_snapshot_fingerprint_check"
    CHECK ("revenue_snapshot_fingerprint" is null or "revenue_snapshot_fingerprint" ~ '^[0-9a-f]{64}$');

CREATE INDEX "company_payment_accounts_revenue_sync_due_idx"
  ON "company_payment_accounts" ("revenue_sync_status", "next_revenue_sync_at")
  WHERE "next_revenue_sync_at" is not null
    AND "revenue_sync_status" in ('idle', 'retrying');

ALTER TABLE "company_payment_receipts"
  DROP CONSTRAINT IF EXISTS "company_payment_receipts_type_check";

ALTER TABLE "company_payment_receipts"
  ADD CONSTRAINT "company_payment_receipts_type_check"
    CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_reconciled', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'operations_configured', 'operations_synced', 'refund_requested', 'refund_succeeded', 'refund_pending', 'refund_failed', 'refund_outcome_unknown', 'refund_webhook_reconciled', 'dispute_webhook_reconciled', 'revenue_auto_synced', 'revenue_auto_sync_failed', 'revoked'));
