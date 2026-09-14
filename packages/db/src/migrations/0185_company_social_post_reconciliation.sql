ALTER TABLE "company_social_posts" DROP CONSTRAINT IF EXISTS "company_social_posts_status_check";
ALTER TABLE "company_social_posts" ADD CONSTRAINT "company_social_posts_status_check" CHECK ("status" in ('awaiting_approval', 'executing', 'submitted', 'scheduled', 'published', 'failed', 'cancelled', 'outcome_unknown'));

ALTER TABLE "company_social_receipts" DROP CONSTRAINT IF EXISTS "company_social_receipts_type_check";
ALTER TABLE "company_social_receipts" ADD CONSTRAINT "company_social_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'post_reconciled', 'revoked'));
