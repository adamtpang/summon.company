ALTER TABLE "company_public_profiles" ADD COLUMN "discovery_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "company_public_abuse_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"category" text NOT NULL,
	"details" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_public_abuse_reports_category_check" CHECK ("company_public_abuse_reports"."category" in ('privacy', 'impersonation', 'fraud', 'harmful_content', 'other')),
	CONSTRAINT "company_public_abuse_reports_status_check" CHECK ("company_public_abuse_reports"."status" in ('open', 'dismissed', 'actioned'))
);
--> statement-breakpoint
ALTER TABLE "company_public_abuse_reports" ADD CONSTRAINT "company_public_abuse_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_public_abuse_reports" ADD CONSTRAINT "company_public_abuse_reports_profile_id_company_public_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."company_public_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_public_abuse_reports_company_status_idx" ON "company_public_abuse_reports" USING btree ("company_id","status","created_at");
--> statement-breakpoint
CREATE INDEX "company_public_abuse_reports_profile_created_idx" ON "company_public_abuse_reports" USING btree ("profile_id","created_at");
