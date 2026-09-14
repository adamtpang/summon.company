ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_status" text DEFAULT 'paused' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_cadence" text DEFAULT 'daily' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_instructions" text;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_enabled_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_next_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_last_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_last_success_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_processing_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_processing_run_id" uuid;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_failure_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_last_error" text;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD COLUMN "automation_last_issue_id" uuid;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_automation_last_issue_id_issues_id_fk" FOREIGN KEY ("automation_last_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_automation_status_check" CHECK ("automation_status" in ('paused', 'active'));
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_automation_cadence_check" CHECK ("automation_cadence" in ('daily', 'weekdays', 'weekly'));
--> statement-breakpoint
ALTER TABLE "company_outreach_campaigns" ADD CONSTRAINT "company_outreach_campaigns_automation_failure_count_check" CHECK ("automation_failure_count" >= 0);
--> statement-breakpoint
CREATE INDEX "company_outreach_campaigns_automation_due_idx" ON "company_outreach_campaigns" USING btree ("automation_status", "automation_next_run_at") WHERE "automation_status" = 'active' and "automation_next_run_at" is not null;
