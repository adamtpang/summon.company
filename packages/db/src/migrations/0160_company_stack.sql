CREATE TABLE "company_stacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"status" text DEFAULT 'provisioning' NOT NULL,
	"github_credential_secret_id" uuid,
	"neon_credential_secret_id" uuid,
	"vercel_credential_secret_id" uuid,
	"github_owner" text NOT NULL,
	"github_repository_name" text NOT NULL,
	"github_repository_id" text,
	"github_repository_full_name" text,
	"github_repository_url" text,
	"neon_org_id" text,
	"neon_region_id" text,
	"neon_project_id" text,
	"neon_branch_id" text,
	"neon_database_name" text,
	"neon_role_name" text,
	"neon_database_secret_id" uuid,
	"vercel_team_id" text,
	"vercel_project_name" text NOT NULL,
	"vercel_project_id" text,
	"vercel_project_url" text,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_stacks_status_check" CHECK ("company_stacks"."status" in ('provisioning', 'ready_for_build', 'partial', 'outcome_unknown', 'failed', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "company_stack_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stack_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_operation_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_stack_receipts_type_check" CHECK ("company_stack_receipts"."type" in ('provisioning_started', 'github_repository_created', 'neon_project_created', 'database_secret_stored', 'vercel_project_created', 'database_variable_created', 'ready_for_build', 'provisioning_failed', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_github_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("github_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_neon_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("neon_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_vercel_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("vercel_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stacks" ADD CONSTRAINT "company_stacks_neon_database_secret_id_company_secrets_id_fk" FOREIGN KEY ("neon_database_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stack_receipts" ADD CONSTRAINT "company_stack_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stack_receipts" ADD CONSTRAINT "company_stack_receipts_stack_id_company_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."company_stacks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_stack_receipts" ADD CONSTRAINT "company_stack_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_stacks_company_status_idx" ON "company_stacks" USING btree ("company_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_stacks_company_name_uq" ON "company_stacks" USING btree ("company_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_stacks_company_github_repository_uq" ON "company_stacks" USING btree ("company_id","github_owner","github_repository_name");
--> statement-breakpoint
CREATE INDEX "company_stack_receipts_company_occurred_idx" ON "company_stack_receipts" USING btree ("company_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "company_stack_receipts_stack_occurred_idx" ON "company_stack_receipts" USING btree ("stack_id","occurred_at");
