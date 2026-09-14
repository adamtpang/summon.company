ALTER TABLE "company_mobile_sources" ADD COLUMN "ios_app_store_connect_app_id" text;--> statement-breakpoint
ALTER TABLE "company_mobile_sources" ADD COLUMN "release_workflow_file_name" text;--> statement-breakpoint

CREATE TABLE "company_mobile_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"mobile_app_id" uuid NOT NULL,
	"build_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"status" text DEFAULT 'dispatching' NOT NULL,
	"platform" text NOT NULL,
	"target" text NOT NULL,
	"git_commit_sha" text NOT NULL,
	"provider_build_id" uuid NOT NULL,
	"workflow_file_name" text NOT NULL,
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
	CONSTRAINT "company_mobile_releases_status_check" CHECK ("status" in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch')),
	CONSTRAINT "company_mobile_releases_platform_check" CHECK ("platform" in ('android', 'ios')),
	CONSTRAINT "company_mobile_releases_target_check" CHECK ("target" in ('google_play_internal_draft', 'app_store_connect')),
	CONSTRAINT "company_mobile_releases_platform_target_check" CHECK (("platform" = 'android' and "target" = 'google_play_internal_draft') or ("platform" = 'ios' and "target" = 'app_store_connect')),
	CONSTRAINT "company_mobile_releases_git_commit_check" CHECK ("git_commit_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "company_mobile_releases_provider_git_commit_check" CHECK ("provider_git_commit_sha" is null or "provider_git_commit_sha" ~ '^[0-9a-f]{40}$')
);--> statement-breakpoint
ALTER TABLE "company_mobile_releases" ADD CONSTRAINT "company_mobile_releases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_releases" ADD CONSTRAINT "company_mobile_releases_mobile_app_id_company_mobile_apps_id_fk" FOREIGN KEY ("mobile_app_id") REFERENCES "public"."company_mobile_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_releases" ADD CONSTRAINT "company_mobile_releases_build_id_company_mobile_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."company_mobile_builds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_releases" ADD CONSTRAINT "company_mobile_releases_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_mobile_releases_app_created_idx" ON "company_mobile_releases" USING btree ("mobile_app_id","created_at");--> statement-breakpoint
CREATE INDEX "company_mobile_releases_company_status_idx" ON "company_mobile_releases" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_releases_app_request_uq" ON "company_mobile_releases" USING btree ("mobile_app_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_releases_build_platform_uq" ON "company_mobile_releases" USING btree ("build_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_releases_provider_run_uq" ON "company_mobile_releases" USING btree ("provider_workflow_run_id") WHERE "provider_workflow_run_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_releases_one_unresolved_per_app_uq" ON "company_mobile_releases" USING btree ("mobile_app_id") WHERE "status" in ('dispatching', 'new', 'in_progress', 'action_required', 'outcome_unknown');--> statement-breakpoint

ALTER TABLE "company_mobile_receipts" ADD COLUMN "release_id" uuid;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_release_id_company_mobile_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."company_mobile_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" DROP CONSTRAINT "company_mobile_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_type_check" CHECK ("type" in ('configured', 'source_planned', 'source_publish_started', 'source_published', 'source_publish_failed', 'build_dispatch_started', 'build_dispatched', 'build_refreshed', 'build_succeeded', 'build_failed', 'build_outcome_unknown', 'build_reconciled', 'webhook_configured', 'build_evidence_received', 'release_dispatch_started', 'release_dispatched', 'release_refreshed', 'release_succeeded', 'release_failed', 'release_outcome_unknown', 'release_reconciled', 'revoked'));
