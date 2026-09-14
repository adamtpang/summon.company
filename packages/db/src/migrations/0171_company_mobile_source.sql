ALTER TABLE "company_mobile_apps" ADD COLUMN "source_repository_id" text;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD COLUMN "source_credential_secret_id" uuid;--> statement-breakpoint
ALTER TABLE "company_mobile_apps" ADD CONSTRAINT "company_mobile_apps_source_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("source_credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "company_mobile_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "mobile_app_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "owner_agent_id" uuid NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "idea" text NOT NULL,
  "target_customer" text NOT NULL,
  "primary_action" text NOT NULL,
  "android_package" text NOT NULL,
  "ios_bundle_identifier" text NOT NULL,
  "template_key" text NOT NULL,
  "template_version" text NOT NULL,
  "manifest_hash" text NOT NULL,
  "manifest_file_count" integer NOT NULL,
  "source_branch" text,
  "source_base_commit_sha" text,
  "source_commit_sha" text,
  "source_tree_sha" text,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_by_agent_id" uuid,
  "requested_by_user_id" text,
  "planned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_mobile_sources_status_check" CHECK ("status" in ('planned', 'publishing', 'source_ready', 'failed', 'outcome_unknown')),
  CONSTRAINT "company_mobile_sources_manifest_count_check" CHECK ("manifest_file_count" > 0 and "manifest_file_count" <= 32),
  CONSTRAINT "company_mobile_sources_manifest_hash_check" CHECK ("manifest_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "company_mobile_sources_base_commit_check" CHECK ("source_base_commit_sha" is null or "source_base_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "company_mobile_sources_commit_check" CHECK ("source_commit_sha" is null or "source_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "company_mobile_sources_tree_check" CHECK ("source_tree_sha" is null or "source_tree_sha" ~ '^[0-9a-f]{40}$')
);--> statement-breakpoint
ALTER TABLE "company_mobile_sources" ADD CONSTRAINT "company_mobile_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_sources" ADD CONSTRAINT "company_mobile_sources_mobile_app_id_company_mobile_apps_id_fk" FOREIGN KEY ("mobile_app_id") REFERENCES "public"."company_mobile_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_sources" ADD CONSTRAINT "company_mobile_sources_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_sources" ADD CONSTRAINT "company_mobile_sources_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_sources_app_uq" ON "company_mobile_sources" USING btree ("mobile_app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_mobile_sources_app_request_uq" ON "company_mobile_sources" USING btree ("mobile_app_id","request_id");--> statement-breakpoint
CREATE INDEX "company_mobile_sources_company_status_idx" ON "company_mobile_sources" USING btree ("company_id","status");--> statement-breakpoint

ALTER TABLE "company_mobile_receipts" DROP CONSTRAINT "company_mobile_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_source_id_company_mobile_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."company_mobile_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_mobile_receipts" ADD CONSTRAINT "company_mobile_receipts_type_check" CHECK ("type" in ('configured', 'source_planned', 'source_publish_started', 'source_published', 'source_publish_failed', 'build_dispatch_started', 'build_dispatched', 'build_refreshed', 'build_succeeded', 'build_failed', 'build_outcome_unknown', 'build_reconciled', 'revoked'));
