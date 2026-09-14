ALTER TABLE "company_stacks" DROP CONSTRAINT "company_stacks_status_check";--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_status_check" CHECK ("status" in ('provisioning', 'ready_for_build', 'source_ready', 'partial', 'outcome_unknown', 'failed', 'revoked'));--> statement-breakpoint
ALTER TABLE "company_stack_receipts" DROP CONSTRAINT "company_stack_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_stack_receipts" ADD CONSTRAINT "company_stack_receipts_type_check" CHECK ("type" in ('provisioning_started', 'github_repository_created', 'neon_project_created', 'database_secret_stored', 'vercel_project_created', 'database_variable_created', 'ready_for_build', 'application_planned', 'source_publish_started', 'source_published', 'website_connected', 'source_publish_failed', 'provisioning_failed', 'revoked'));--> statement-breakpoint
CREATE TABLE "company_stack_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stack_id" uuid NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"application_name" text NOT NULL,
	"idea" text NOT NULL,
	"target_customer" text NOT NULL,
	"template_key" text NOT NULL,
	"template_version" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"source_branch" text,
	"source_base_commit_sha" text,
	"source_commit_sha" text,
	"source_tree_sha" text,
	"manifest_hash" text NOT NULL,
	"manifest_file_count" integer NOT NULL,
	"website_id" uuid,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_stack_applications_status_check" CHECK ("status" in ('planned', 'publishing', 'source_ready', 'outcome_unknown', 'failed')),
	CONSTRAINT "company_stack_applications_manifest_count_check" CHECK ("manifest_file_count" > 0 and "manifest_file_count" <= 32)
);--> statement-breakpoint
ALTER TABLE "company_stack_applications" ADD CONSTRAINT "company_stack_applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_stack_applications" ADD CONSTRAINT "company_stack_applications_stack_id_company_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."company_stacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_stack_applications" ADD CONSTRAINT "company_stack_applications_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_stack_applications" ADD CONSTRAINT "company_stack_applications_website_id_company_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."company_websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_stack_applications_stack_uq" ON "company_stack_applications" USING btree ("stack_id");--> statement-breakpoint
CREATE INDEX "company_stack_applications_company_status_idx" ON "company_stack_applications" USING btree ("company_id","status");
