CREATE TABLE "company_media_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"cadence" text DEFAULT 'daily' NOT NULL,
	"brief" text NOT NULL,
	"purpose" text NOT NULL,
	"format" text NOT NULL,
	"video_duration_seconds" integer,
	"owner_agent_id" uuid NOT NULL,
	"project_id" uuid,
	"enabled_by_user_id" text,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"processing_started_at" timestamp with time zone,
	"processing_run_id" uuid,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_issue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_media_schedules_status_check" CHECK ("company_media_schedules"."status" in ('paused', 'active')),
	CONSTRAINT "company_media_schedules_kind_check" CHECK ("company_media_schedules"."kind" in ('image', 'video')),
	CONSTRAINT "company_media_schedules_cadence_check" CHECK ("company_media_schedules"."cadence" in ('daily', 'weekdays', 'weekly')),
	CONSTRAINT "company_media_schedules_purpose_check" CHECK ("company_media_schedules"."purpose" in ('website', 'social', 'advertising', 'product', 'internal')),
	CONSTRAINT "company_media_schedules_format_check" CHECK ("company_media_schedules"."format" in ('square', 'portrait', 'landscape')),
	CONSTRAINT "company_media_schedules_duration_check" CHECK (("company_media_schedules"."kind" = 'image' and "company_media_schedules"."video_duration_seconds" is null) or ("company_media_schedules"."kind" = 'video' and "company_media_schedules"."video_duration_seconds" in (4, 8, 12, 15))),
	CONSTRAINT "company_media_schedules_failure_count_check" CHECK ("company_media_schedules"."failure_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "company_media_schedules" ADD CONSTRAINT "company_media_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_media_schedules" ADD CONSTRAINT "company_media_schedules_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_media_schedules" ADD CONSTRAINT "company_media_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_media_schedules" ADD CONSTRAINT "company_media_schedules_last_issue_id_issues_id_fk" FOREIGN KEY ("last_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_media_schedules_company_kind_uq" ON "company_media_schedules" USING btree ("company_id","kind");
--> statement-breakpoint
CREATE INDEX "company_media_schedules_due_idx" ON "company_media_schedules" USING btree ("status","next_run_at") WHERE "company_media_schedules"."status" = 'active' and "company_media_schedules"."next_run_at" is not null;
