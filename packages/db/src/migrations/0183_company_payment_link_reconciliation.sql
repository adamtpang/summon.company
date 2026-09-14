ALTER TABLE "company_payment_offers" DROP CONSTRAINT IF EXISTS "company_payment_offers_status_check";
ALTER TABLE "company_payment_offers" ADD CONSTRAINT "company_payment_offers_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'active', 'inactive', 'failed', 'outcome_unknown'));

ALTER TABLE "company_payment_receipts" DROP CONSTRAINT IF EXISTS "company_payment_receipts_type_check";
ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_reconciled', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'operations_configured', 'operations_synced', 'refund_requested', 'refund_succeeded', 'refund_pending', 'refund_failed', 'refund_outcome_unknown', 'revoked'));
