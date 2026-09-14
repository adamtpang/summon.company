ALTER TABLE "company_payment_receipts" DROP CONSTRAINT IF EXISTS "company_payment_receipts_type_check";
ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_reconciled', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'operations_configured', 'operations_synced', 'refund_requested', 'refund_succeeded', 'refund_pending', 'refund_failed', 'refund_outcome_unknown', 'refund_webhook_reconciled', 'dispute_webhook_reconciled', 'revoked'));

CREATE UNIQUE INDEX "company_payment_receipts_webhook_event_type_uq"
  ON "company_payment_receipts" ("account_id", "type", "provider_operation_id")
  WHERE "provider_operation_id" IS NOT NULL
    AND "type" IN ('refund_webhook_reconciled', 'dispute_webhook_reconciled');
