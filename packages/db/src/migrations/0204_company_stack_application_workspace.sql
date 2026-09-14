ALTER TABLE "company_stack_applications"
  ADD COLUMN IF NOT EXISTS "project_id" uuid;

ALTER TABLE "company_stack_applications"
  ADD COLUMN IF NOT EXISTS "project_workspace_id" uuid;

DO $$
BEGIN
  ALTER TABLE "company_stack_applications"
    ADD CONSTRAINT "company_stack_applications_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "company_stack_applications"
    ADD CONSTRAINT "company_stack_applications_project_workspace_id_project_workspaces_id_fk"
    FOREIGN KEY ("project_workspace_id") REFERENCES "project_workspaces"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "company_stack_applications_project_idx"
  ON "company_stack_applications" ("project_id");

ALTER TABLE "company_stack_receipts"
  DROP CONSTRAINT IF EXISTS "company_stack_receipts_type_check";

ALTER TABLE "company_stack_receipts"
  ADD CONSTRAINT "company_stack_receipts_type_check"
  CHECK (
    "type" IN (
      'provisioning_started',
      'github_repository_created',
      'neon_project_created',
      'database_secret_stored',
      'vercel_project_created',
      'database_variable_created',
      'ready_for_build',
      'application_planned',
      'source_publish_started',
      'source_published',
      'application_workspace_connected',
      'website_connected',
      'source_publish_failed',
      'database_snapshot_started',
      'database_snapshot_ready',
      'database_snapshot_failed',
      'database_snapshot_expired',
      'database_snapshot_deleted',
      'provisioning_failed',
      'recovery_started',
      'github_repository_reconciled',
      'neon_project_reconciled',
      'vercel_project_reconciled',
      'database_variable_reconciled',
      'recovery_failed',
      'revoked'
    )
  );
