CREATE TABLE "company_nightshift_schedules" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"start_hour_utc" integer DEFAULT 0 NOT NULL,
	"duration_hours" integer DEFAULT 4 NOT NULL,
	"max_tasks" integer DEFAULT 3 NOT NULL,
	"spend_limit_cents" integer DEFAULT 500 NOT NULL,
	"enabled_by_user_id" text,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"processing_started_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_cycle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_nightshift_schedules_status_check" CHECK ("company_nightshift_schedules"."status" in ('paused', 'active')),
	CONSTRAINT "company_nightshift_schedules_start_hour_check" CHECK ("company_nightshift_schedules"."start_hour_utc" between 0 and 23),
	CONSTRAINT "company_nightshift_schedules_duration_check" CHECK ("company_nightshift_schedules"."duration_hours" in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 48, 72, 120)),
	CONSTRAINT "company_nightshift_schedules_task_limit_check" CHECK ("company_nightshift_schedules"."max_tasks" between 1 and 5),
	CONSTRAINT "company_nightshift_schedules_spend_limit_check" CHECK ("company_nightshift_schedules"."spend_limit_cents" between 100 and 100000),
	CONSTRAINT "company_nightshift_schedules_failure_count_check" CHECK ("company_nightshift_schedules"."failure_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "company_nightshift_schedules" ADD CONSTRAINT "company_nightshift_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_nightshift_schedules_due_idx" ON "company_nightshift_schedules" USING btree ("status","next_run_at") WHERE "company_nightshift_schedules"."status" = 'active' and "company_nightshift_schedules"."next_run_at" is not null;
