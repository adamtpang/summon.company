CREATE TABLE "company_finance_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "provider_key" text NOT NULL,
  "environment" text NOT NULL,
  "display_name" text NOT NULL,
  "owner_agent_id" uuid NOT NULL,
  "client_id_secret_id" uuid NOT NULL,
  "client_secret_secret_id" uuid NOT NULL,
  "access_token_secret_id" uuid,
  "link_token_secret_id" uuid,
  "external_item_fingerprint" text,
  "connection_status" text DEFAULT 'link_pending' NOT NULL,
  "sync_status" text DEFAULT 'idle' NOT NULL,
  "sync_coverage" text DEFAULT 'unavailable' NOT NULL,
  "sync_cursor" text,
  "available_cash_cents" bigint,
  "current_cash_cents" bigint,
  "cash_currency" text,
  "account_count" integer DEFAULT 0 NOT NULL,
  "active_transaction_count" integer DEFAULT 0 NOT NULL,
  "pending_transaction_count" integer DEFAULT 0 NOT NULL,
  "foreign_currency_transaction_count" integer DEFAULT 0 NOT NULL,
  "current_month_expense_cents" bigint DEFAULT 0 NOT NULL,
  "current_month_expense_transaction_count" integer DEFAULT 0 NOT NULL,
  "last_synced_at" timestamp with time zone,
  "next_sync_at" timestamp with time zone,
  "sync_started_at" timestamp with time zone,
  "sync_failure_count" integer DEFAULT 0 NOT NULL,
  "last_sync_error" text,
  "snapshot_fingerprint" text,
  "link_expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_finance_connections_provider_check" CHECK ("provider_key" = 'plaid'),
  CONSTRAINT "company_finance_connections_environment_check" CHECK ("environment" in ('sandbox', 'production')),
  CONSTRAINT "company_finance_connections_status_check" CHECK ("connection_status" in ('link_pending', 'connected', 'error', 'revoked')),
  CONSTRAINT "company_finance_connections_sync_status_check" CHECK ("sync_status" in ('idle', 'processing', 'retrying', 'error', 'revoked')),
  CONSTRAINT "company_finance_connections_sync_coverage_check" CHECK ("sync_coverage" in ('unavailable', 'complete', 'test_mode', 'foreign_currency', 'bounded')),
  CONSTRAINT "company_finance_connections_item_fingerprint_check" CHECK ("external_item_fingerprint" is null or "external_item_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "company_finance_connections_snapshot_fingerprint_check" CHECK ("snapshot_fingerprint" is null or "snapshot_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "company_finance_connections_nonnegative_metrics_check" CHECK ("available_cash_cents" is null or "available_cash_cents" >= 0),
  CONSTRAINT "company_finance_connections_nonnegative_counts_check" CHECK ("account_count" >= 0 and "active_transaction_count" >= 0 and "pending_transaction_count" >= 0 and "foreign_currency_transaction_count" >= 0 and "current_month_expense_cents" >= 0 and "current_month_expense_transaction_count" >= 0 and "sync_failure_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_finance_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "external_transaction_fingerprint" text NOT NULL,
  "external_account_fingerprint" text NOT NULL,
  "occurred_on" date NOT NULL,
  "direction" text NOT NULL,
  "amount_cents" bigint NOT NULL,
  "currency" text NOT NULL,
  "display_name" text NOT NULL,
  "category_primary" text,
  "category_detailed" text,
  "pending" boolean DEFAULT false NOT NULL,
  "expense_eligible" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "removed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_finance_transactions_transaction_fingerprint_check" CHECK ("external_transaction_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "company_finance_transactions_account_fingerprint_check" CHECK ("external_account_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "company_finance_transactions_direction_check" CHECK ("direction" in ('debit', 'credit')),
  CONSTRAINT "company_finance_transactions_status_check" CHECK ("status" in ('active', 'removed')),
  CONSTRAINT "company_finance_transactions_amount_check" CHECK ("amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "company_finance_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_agent_id" uuid,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_finance_receipts_type_check" CHECK ("type" in ('link_started', 'connected', 'synced', 'sync_failed', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_client_id_secret_id_company_secrets_id_fk" FOREIGN KEY ("client_id_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_client_secret_secret_id_company_secrets_id_fk" FOREIGN KEY ("client_secret_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_access_token_secret_id_company_secrets_id_fk" FOREIGN KEY ("access_token_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_connections" ADD CONSTRAINT "company_finance_connections_link_token_secret_id_company_secrets_id_fk" FOREIGN KEY ("link_token_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_transactions" ADD CONSTRAINT "company_finance_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_transactions" ADD CONSTRAINT "company_finance_transactions_connection_id_company_finance_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."company_finance_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_receipts" ADD CONSTRAINT "company_finance_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_receipts" ADD CONSTRAINT "company_finance_receipts_connection_id_company_finance_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."company_finance_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_finance_receipts" ADD CONSTRAINT "company_finance_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_finance_connections_company_status_idx" ON "company_finance_connections" USING btree ("company_id", "connection_status");
--> statement-breakpoint
CREATE INDEX "company_finance_connections_sync_due_idx" ON "company_finance_connections" USING btree ("sync_status", "next_sync_at") WHERE "next_sync_at" is not null and "sync_status" in ('idle', 'retrying');
--> statement-breakpoint
CREATE UNIQUE INDEX "company_finance_connections_company_item_uq" ON "company_finance_connections" USING btree ("company_id", "provider_key", "external_item_fingerprint") WHERE "external_item_fingerprint" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_finance_transactions_connection_transaction_uq" ON "company_finance_transactions" USING btree ("connection_id", "external_transaction_fingerprint");
--> statement-breakpoint
CREATE INDEX "company_finance_transactions_company_occurred_idx" ON "company_finance_transactions" USING btree ("company_id", "occurred_on");
--> statement-breakpoint
CREATE INDEX "company_finance_transactions_connection_occurred_idx" ON "company_finance_transactions" USING btree ("connection_id", "occurred_on");
--> statement-breakpoint
CREATE INDEX "company_finance_receipts_company_occurred_idx" ON "company_finance_receipts" USING btree ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX "company_finance_receipts_connection_occurred_idx" ON "company_finance_receipts" USING btree ("connection_id", "occurred_at");
