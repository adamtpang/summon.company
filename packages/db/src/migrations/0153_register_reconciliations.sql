CREATE TABLE IF NOT EXISTS "register_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"repo" text NOT NULL,
	"register_path" text NOT NULL,
	"register_commit" text NOT NULL,
	"head_commit" text NOT NULL,
	"head_branch" text,
	"commits_since_register" integer DEFAULT 0 NOT NULL,
	"findings_total" integer DEFAULT 0 NOT NULL,
	"findings_closed" integer DEFAULT 0 NOT NULL,
	"findings_partial" integer DEFAULT 0 NOT NULL,
	"findings_needs_human" integer DEFAULT 0 NOT NULL,
	"receipt" jsonb,
	"proposed_diff" text,
	"mode" text DEFAULT 'propose_only' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"issue_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "register_reconciliations" ADD CONSTRAINT "register_reconciliations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "register_reconciliations" ADD CONSTRAINT "register_reconciliations_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "register_reconciliations_company_created_idx" ON "register_reconciliations" ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "register_reconciliations_repo_register_idx" ON "register_reconciliations" ("repo","register_path");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "register_reconciliations_unique_run_idx" ON "register_reconciliations" ("company_id","repo","register_path","head_commit");
