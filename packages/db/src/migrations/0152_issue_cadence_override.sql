ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "cadence_override" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "issues" ADD CONSTRAINT "issues_cadence_override_check" CHECK ("cadence_override" is null or "cadence_override" in ('hot', 'recent', 'stale'));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
