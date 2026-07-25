CREATE TABLE IF NOT EXISTS "issue_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"comment_id" uuid,
	"author_agent_id" uuid,
	"created_by_run_id" uuid,
	"money_saved_cents" integer,
	"time_saved_minutes" integer,
	"revenue_moved_cents" integer,
	"risk_avoided" text,
	"confidence" text NOT NULL,
	"method" text NOT NULL,
	"raw_json" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_outcomes_confidence_check" CHECK ("issue_outcomes"."confidence" in ('measured', 'estimated', 'unmeasurable'))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_comment_id_issue_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issue_outcomes" ADD CONSTRAINT "issue_outcomes_created_by_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("created_by_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issue_outcomes_issue_unique_idx" ON "issue_outcomes" USING btree ("issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_outcomes_company_completed_at_idx" ON "issue_outcomes" USING btree ("company_id","completed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_outcomes_company_confidence_idx" ON "issue_outcomes" USING btree ("company_id","confidence");
