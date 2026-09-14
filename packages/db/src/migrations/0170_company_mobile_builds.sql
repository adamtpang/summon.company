CREATE TABLE "company_mobile_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "owner_agent_id" uuid NOT NULL,
  "status" text DEFAULT 'configured' NOT NULL,
  "expo_project_id" uuid NOT NULL,
  "repository_full_name" text NOT NULL,
  "workflow_file_name" text NOT NULL,
  "credential_secret_id" uuid,
  "latest_build_status" text,
  "last_synced_at" timestamp with time zone,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_mobile_apps_status_check" CHECK ("status" in ('configured', 'active', 'attention', 'revoked')),
  CONSTRAINT "company_mobile_apps_latest_build_status_check" CHECK ("latest_build_status" is null or "latest_build_status" in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch'))
);--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_mobile_apps_company_status_idx" ON "company_mobile_apps" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_apps_one_active_per_company_uq" ON "company_mobile_apps" USING btree ("company_id") WHERE "status" <> 'revoked';--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_apps_active_expo_project_uq" ON "company_mobile_apps" USING btree ("company_id","expo_project_id") WHERE "status" <> 'revoked';--> statement-breakpoint

CREATE TABLE "company_mobile_builds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "mobile_app_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "status" text DEFAULT 'dispatching' NOT NULL,
  "platform" text NOT NULL,
  "profile" text NOT NULL,
  "git_commit_sha" text NOT NULL,
  "provider_workflow_run_id" uuid,
  "provider_workflow_run_url" text,
  "provider_git_commit_sha" text,
  "jobs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_by_agent_id" uuid,
  "requested_by_user_id" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_synced_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_mobile_builds_status_check" CHECK ("status" in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch')),
  CONSTRAINT "company_mobile_builds_platform_check" CHECK ("platform" in ('android', 'ios', 'all')),
  CONSTRAINT "company_mobile_builds_profile_check" CHECK ("profile" in ('development', 'preview', 'production')),
  CONSTRAINT "company_mobile_builds_git_commit_check" CHECK ("git_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "company_mobile_builds_provider_git_commit_check" CHECK ("provider_git_commit_sha" is null or "provider_git_commit_sha" ~ '^[0-9a-f]{40}$')
);--> statement-breakpoint
ALTER TABLE "company_mobile_builds" ADD CONSTRAINT "company_mobile_builds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_builds" ADD CONSTRAINT "company_mobile_builds_mobile_app_id_company_mobile_apps_id_fk" FOREIGN KEY ("mobile_app_id") REFERENCES "public"."company_mobile_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_builds" ADD CONSTRAINT "company_mobile_builds_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_mobile_builds_app_created_idx" ON "company_mobile_builds" USING btree ("mobile_app_id","created_at");--> statement-breakpoint
CREATE INDEX "company_mobile_builds_company_status_idx" ON "company_mobile_builds" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_builds_app_request_uq" ON "company_mobile_builds" USING btree ("mobile_app_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_builds_provider_run_uq" ON "company_mobile_builds" USING btree ("provider_workflow_run_id") WHERE "provider_workflow_run_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_builds_one_unresolved_per_app_uq" ON "company_mobile_builds" USING btree ("mobile_app_id") WHERE "status" in ('dispatching', 'new', 'in_progress', 'action_required', 'outcome_unknown');--> statement-breakpoint

CREATE TABLE "company_mobile_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "mobile_app_id" uuid NOT NULL,
  "build_id" uuid,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "provider_operation_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_agent_id" uuid,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_mobile_receipts_type_check" CHECK ("type" in ('configured', 'build_dispatch_started', 'build_dispatched', 'build_refreshed', 'build_succeeded', 'build_failed', 'build_outcome_unknown', 'build_reconciled', 'revoked'))
);--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_mobile_app_id_company_mobile_apps_id_fk" FOREIGN KEY ("mobile_app_id") REFERENCES "public"."company_mobile_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_build_id_company_mobile_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."company_mobile_builds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_mobile_receipts_app_occurred_idx" ON "company_mobile_receipts" USING btree ("mobile_app_id","occurred_at");--> statement-breakpoint
CREATE INDEX "company_mobile_receipts_company_occurred_idx" ON "company_mobile_receipts" USING btree ("company_id","occurred_at");
