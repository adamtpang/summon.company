ALTER TABLE "company_finance_connections" ADD COLUMN "revocation_status" text DEFAULT 'not_requested' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD COLUMN "revocation_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD COLUMN "revocation_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD COLUMN "next_revocation_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD COLUMN "revocation_failure_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD COLUMN "last_revocation_error" text;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_revocation_status_check" CHECK ("revocation_status" in ('not_requested', 'processing', 'retrying', 'error', 'confirmed'));
--> statement-breakpoint
ALTER TABLE "company_finance_connections" DROP CONSTRAINT "company_finance_connections_nonnegative_counts_check";
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_nonnegative_counts_check" CHECK ("account_count" >= 0 and "active_transaction_count" >= 0 and "pending_transaction_count" >= 0 and "foreign_currency_transaction_count" >= 0 and "current_month_expense_cents" >= 0 and "current_month_expense_transaction_count" >= 0 and "sync_failure_count" >= 0 and "revocation_failure_count" >= 0);
--> statement-breakpoint
ALTER TABLE "company_finance_receipts" DROP CONSTRAINT "company_finance_receipts_type_check";
--> statement-breakpoint
ALTER TABLE "company_finance_receipts" ADD CONSTRAINT "company_finance_receipts_type_check" CHECK ("type" in ('link_started', 'connected', 'synced', 'sync_failed', 'revocation_started', 'revocation_failed', 'revoked'));
--> statement-breakpoint
CREATE INDEX "company_finance_connections_revocation_due_idx" ON "company_finance_connections" USING btree ("revocation_status", "next_revocation_attempt_at") WHERE "next_revocation_attempt_at" is not null and "revocation_status" = 'retrying';
