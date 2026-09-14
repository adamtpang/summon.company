ALTER TABLE "company_stack_receipts" DROP CONSTRAINT IF EXISTS "company_stack_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_stack_receipts" ADD CONSTRAINT "company_stack_receipts_type_check" CHECK ("type" in ('provisioning_started', 'github_repository_created', 'neon_project_created', 'database_secret_stored', 'vercel_project_created', 'database_variable_created', 'ready_for_build', 'application_planned', 'source_publish_started', 'source_published', 'website_connected', 'source_publish_failed', 'database_snapshot_started', 'database_snapshot_ready', 'database_snapshot_failed', 'database_snapshot_expired', 'database_snapshot_deleted', 'provisioning_failed', 'revoked'));--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "company_stack_database_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "stack_id" uuid NOT NULL,
  "status" text DEFAULT 'exporting' NOT NULL,
  "filename" text NOT NULL,
  "storage_provider" text,
  "object_key" text,
  "content_type" text NOT NULL,
  "byte_size" integer,
  "sha256" text,
  "pg_dump_version" text,
  "last_error" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requested_by_user_id" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_stack_database_snapshots_status_check" CHECK ("status" in ('exporting', 'ready', 'failed', 'expired', 'deleted')),
  CONSTRAINT "company_stack_database_snapshots_byte_size_check" CHECK ("byte_size" is null or "byte_size" >= 0)
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_stack_database_snapshots" ADD CONSTRAINT "company_stack_database_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_stack_database_snapshots" ADD CONSTRAINT "company_stack_database_snapshots_stack_id_company_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "company_stacks"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_stack_database_snapshots_company_stack_created_idx" ON "company_stack_database_snapshots" ("company_id", "stack_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_stack_database_snapshots_company_expiry_idx" ON "company_stack_database_snapshots" ("company_id", "status", "expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_stack_database_snapshots_one_exporting_per_stack_uq" ON "company_stack_database_snapshots" ("stack_id") WHERE "status" = 'exporting';
