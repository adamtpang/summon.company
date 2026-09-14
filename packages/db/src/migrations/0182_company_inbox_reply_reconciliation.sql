ALTER TABLE "company_inbox_receipts" DROP CONSTRAINT IF EXISTS "company_inbox_receipts_type_check";
ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'message_received', 'work_created', 'reply_drafted', 'reply_requested', 'reply_reserved', 'reply_submitted', 'reply_reconciled', 'reply_failed', 'revoked'));
