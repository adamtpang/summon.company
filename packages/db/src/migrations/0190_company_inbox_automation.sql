ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_status" text DEFAULT 'paused' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_interval_minutes" integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_prompt" text;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_create_work" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_enabled_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_next_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_last_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_last_success_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_processing_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_failure_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD COLUMN "automation_last_error" text;
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_automation_status_check" CHECK ("automation_status" in ('paused', 'active'));
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_automation_interval_check" CHECK ("automation_interval_minutes" in (5, 15, 30, 60, 180, 360, 720, 1440));
--> statement-breakpoint
ALTER TABLE "company_inbox_connectors" ADD CONSTRAINT "company_inbox_connectors_automation_failure_count_check" CHECK ("automation_failure_count" >= 0);
--> statement-breakpoint
CREATE INDEX "company_inbox_connectors_automation_due_idx" ON "company_inbox_connectors" USING btree ("automation_status", "automation_next_run_at") WHERE "automation_status" = 'active' and "automation_next_run_at" is not null;
