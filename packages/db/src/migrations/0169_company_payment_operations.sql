ALTER TABLE "company_payment_accounts" ADD COLUMN "operations_credential_secret_id" uuid;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "operations_status" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "operations_configured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "last_operations_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "last_operations_error" text;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "recent_customer_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "recent_refund_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "recent_refunded_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "open_dispute_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD COLUMN "open_disputed_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_operations_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("operations_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_operations_status_check" CHECK ("operations_status" in ('unconfigured', 'ready', 'error', 'revoked'));--> statement-breakpoint
ALTER TABLE "company_payment_accounts" DROP CONSTRAINT IF EXISTS "company_payment_accounts_nonnegative_metrics_check";--> statement-breakpoint
ALTER TABLE "company_payment_accounts" ADD CONSTRAINT "company_payment_accounts_nonnegative_metrics_check" CHECK ("recent_payment_count" >= 0 and "recent_gross_cents" >= 0 and "active_subscription_count" >= 0 and "recent_customer_count" >= 0 and "recent_refund_count" >= 0 and "recent_refunded_cents" >= 0 and "open_dispute_count" >= 0 and "open_disputed_cents" >= 0);--> statement-breakpoint

ALTER TABLE "company_payment_receipts" DROP CONSTRAINT IF EXISTS "company_payment_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_payment_receipts" ADD CONSTRAINT "company_payment_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'operations_configured', 'operations_synced', 'refund_requested', 'refund_succeeded', 'refund_pending', 'refund_failed', 'refund_outcome_unknown', 'revoked'));--> statement-breakpoint

CREATE TABLE "company_payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "payment_receipt_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "status" text NOT NULL,
  "reason" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "external_checkout_session_id" text NOT NULL,
  "external_payment_intent_id" text,
  "external_refund_id" text,
  "provider_operation_id" text NOT NULL,
  "requested_by_user_id" text NOT NULL,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_payment_refunds_status_check" CHECK ("status" in ('submitting', 'pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'outcome_unknown')),
  CONSTRAINT "company_payment_refunds_reason_check" CHECK ("reason" in ('duplicate', 'requested_by_customer')),
  CONSTRAINT "company_payment_refunds_amount_check" CHECK ("amount_cents" > 0)
);--> statement-breakpoint
ALTER TABLE "company_payment_refunds" ADD CONSTRAINT "company_payment_refunds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_refunds" ADD CONSTRAINT "company_payment_refunds_account_id_company_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."company_payment_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_refunds" ADD CONSTRAINT "company_payment_refunds_payment_receipt_id_company_payment_receipts_id_fk" FOREIGN KEY ("payment_receipt_id") REFERENCES "public"."company_payment_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_payment_refunds_account_created_idx" ON "company_payment_refunds" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_payment_refunds_account_request_uq" ON "company_payment_refunds" USING btree ("account_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_payment_refunds_account_external_refund_uq" ON "company_payment_refunds" USING btree ("account_id","external_refund_id") WHERE "external_refund_id" is not null;--> statement-breakpoint

CREATE TABLE "company_payment_disputes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "external_dispute_id" text NOT NULL,
  "status" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "reason" text NOT NULL,
  "due_by" timestamp with time zone,
  "provider_created_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_payment_disputes_status_check" CHECK ("status" in ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost', 'prevented')),
  CONSTRAINT "company_payment_disputes_amount_check" CHECK ("amount_cents" >= 0)
);--> statement-breakpoint
ALTER TABLE "company_payment_disputes" ADD CONSTRAINT "company_payment_disputes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_disputes" ADD CONSTRAINT "company_payment_disputes_account_id_company_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."company_payment_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_payment_disputes_account_status_idx" ON "company_payment_disputes" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_payment_disputes_account_external_uq" ON "company_payment_disputes" USING btree ("account_id","external_dispute_id");
