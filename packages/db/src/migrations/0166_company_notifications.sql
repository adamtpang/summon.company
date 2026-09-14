CREATE TABLE IF NOT EXISTS "company_notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "connector_id" uuid NOT NULL,
  "activity_id" uuid NOT NULL,
  "event_kind" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "target_path" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now(),
  "provider_operation_id" text,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reserved_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_notification_deliveries_event_kind_check" CHECK ("event_kind" in ('board_decision', 'customer_message', 'operational_alert', 'budget_stop', 'nightshift_complete', 'nightshift_failed', 'daily_brief')),
  CONSTRAINT "company_notification_deliveries_severity_check" CHECK ("severity" in ('low', 'medium', 'high', 'critical')),
  CONSTRAINT "company_notification_deliveries_status_check" CHECK ("status" in ('pending', 'delivering', 'delivered', 'failed', 'outcome_unknown', 'revoked')),
  CONSTRAINT "company_notification_deliveries_attempt_check" CHECK ("attempt_count" >= 0 and "attempt_count" <= 5)
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_deliveries" ADD CONSTRAINT "company_notification_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_deliveries" ADD CONSTRAINT "company_notification_deliveries_connector_id_company_inbox_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "company_inbox_connectors"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_deliveries" ADD CONSTRAINT "company_notification_deliveries_activity_id_activity_log_id_fk" FOREIGN KEY ("activity_id") REFERENCES "activity_log"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_notification_deliveries_connector_activity_uq" ON "company_notification_deliveries" ("connector_id", "activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_notification_deliveries_company_due_idx" ON "company_notification_deliveries" ("company_id", "status", "next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_notification_deliveries_connector_created_idx" ON "company_notification_deliveries" ("connector_id", "created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "company_notification_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "delivery_id" uuid NOT NULL,
  "connector_id" uuid NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "attempt" integer DEFAULT 0 NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_notification_receipts_type_check" CHECK ("type" in ('captured', 'delivery_reserved', 'delivered', 'delivery_failed', 'outcome_unknown', 'revoked')),
  CONSTRAINT "company_notification_receipts_attempt_check" CHECK ("attempt" >= 0 and "attempt" <= 5)
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_receipts" ADD CONSTRAINT "company_notification_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_receipts" ADD CONSTRAINT "company_notification_receipts_delivery_id_company_notification_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "company_notification_deliveries"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_receipts" ADD CONSTRAINT "company_notification_receipts_connector_id_company_inbox_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "company_inbox_connectors"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_notification_receipts_delivery_attempt_type_uq" ON "company_notification_receipts" ("delivery_id", "attempt", "type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_notification_receipts_company_occurred_idx" ON "company_notification_receipts" ("company_id", "occurred_at");
