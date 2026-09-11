ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "last_resumed_at" timestamp with time zone;
