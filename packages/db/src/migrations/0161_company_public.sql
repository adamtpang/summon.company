CREATE TABLE "company_public_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"website_url" text,
	"search_indexing" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'private' NOT NULL,
	"department_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"roster_snapshot_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"unpublished_at" timestamp with time zone,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_public_profiles_status_check" CHECK ("company_public_profiles"."status" in ('private', 'public')),
	CONSTRAINT "company_public_profiles_slug_check" CHECK ("company_public_profiles"."slug" ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')
);
--> statement-breakpoint
ALTER TABLE "company_public_profiles" ADD CONSTRAINT "company_public_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_public_profiles_company_uq" ON "company_public_profiles" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_public_profiles_slug_uq" ON "company_public_profiles" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "company_public_profiles_status_idx" ON "company_public_profiles" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "company_public_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"public_url" text,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"evidence" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by_user_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_public_updates_category_check" CHECK ("company_public_updates"."category" in ('milestone', 'launch', 'outcome', 'social', 'infrastructure')),
	CONSTRAINT "company_public_updates_source_type_check" CHECK ("company_public_updates"."source_type" in ('issue_outcome', 'website_receipt', 'payment_receipt', 'social_receipt', 'stack_receipt'))
);
--> statement-breakpoint
ALTER TABLE "company_public_updates" ADD CONSTRAINT "company_public_updates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_public_updates" ADD CONSTRAINT "company_public_updates_profile_id_company_public_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."company_public_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_public_updates_company_published_idx" ON "company_public_updates" USING btree ("company_id","published_at");
--> statement-breakpoint
CREATE INDEX "company_public_updates_profile_published_idx" ON "company_public_updates" USING btree ("profile_id","published_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_public_updates_source_uq" ON "company_public_updates" USING btree ("company_id","source_type","source_id");
