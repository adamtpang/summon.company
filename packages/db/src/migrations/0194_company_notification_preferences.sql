CREATE TABLE IF NOT EXISTS "company_notification_preferences" (
  "company_id" uuid PRIMARY KEY NOT NULL,
  "enabled_event_kinds" text[] DEFAULT ARRAY['board_decision','customer_message','operational_alert','budget_stop','nightshift_complete','nightshift_failed','daily_brief']::text[] NOT NULL,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_notification_preferences_enabled_kinds_check" CHECK ("enabled_event_kinds" <@ ARRAY['board_decision','customer_message','operational_alert','budget_stop','nightshift_complete','nightshift_failed','daily_brief']::text[])
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "company_notification_preferences" ADD CONSTRAINT "company_notification_preferences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;
