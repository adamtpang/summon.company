ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "operating_mode" text DEFAULT 'manual' NOT NULL;
