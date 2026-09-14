CREATE TABLE "company_ad_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"external_ad_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"external_page_id" text NOT NULL,
	"page_name" text NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"credential_secret_id" uuid,
	"connection_status" text DEFAULT 'connected' NOT NULL,
	"currency" text NOT NULL,
	"timezone_name" text NOT NULL,
	"external_account_status" integer NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"spend_cap_cents" integer,
	"balance_cents" integer,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ad_connections_status_check" CHECK ("company_ad_connections"."connection_status" in ('connected', 'error', 'revoked')),
	CONSTRAINT "company_ad_connections_currency_check" CHECK ("company_ad_connections"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "company_ad_connections_nonnegative_money_check" CHECK (("company_ad_connections"."spend_cap_cents" is null or "company_ad_connections"."spend_cap_cents" >= 0) and ("company_ad_connections"."balance_cents" is null or "company_ad_connections"."balance_cents" >= 0))
);
--> statement-breakpoint
CREATE TABLE "company_ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" text DEFAULT 'OUTCOME_TRAFFIC' NOT NULL,
	"status" text NOT NULL,
	"destination_url" text NOT NULL,
	"primary_text" text NOT NULL,
	"headline" text NOT NULL,
	"description" text,
	"call_to_action" text NOT NULL,
	"image_hash" text NOT NULL,
	"countries" jsonb NOT NULL,
	"age_min" integer NOT NULL,
	"age_max" integer NOT NULL,
	"daily_target_cents" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"lifetime_budget_cents" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"external_campaign_id" text,
	"external_ad_set_id" text,
	"external_creative_id" text,
	"external_ad_id" text,
	"approval_id" uuid,
	"provider_operation_id" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"landing_page_views" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ad_campaigns_status_check" CHECK ("company_ad_campaigns"."status" in ('awaiting_approval', 'provisioning', 'active', 'paused', 'completed', 'outcome_unknown', 'failed')),
	CONSTRAINT "company_ad_campaigns_objective_check" CHECK ("company_ad_campaigns"."objective" = 'OUTCOME_TRAFFIC'),
	CONSTRAINT "company_ad_campaigns_cta_check" CHECK ("company_ad_campaigns"."call_to_action" in ('LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW')),
	CONSTRAINT "company_ad_campaigns_audience_check" CHECK ("company_ad_campaigns"."age_min" between 18 and 65 and "company_ad_campaigns"."age_max" between "company_ad_campaigns"."age_min" and 65),
	CONSTRAINT "company_ad_campaigns_budget_check" CHECK ("company_ad_campaigns"."daily_target_cents" between 1000 and 100000 and "company_ad_campaigns"."duration_days" between 1 and 30 and "company_ad_campaigns"."lifetime_budget_cents" = "company_ad_campaigns"."daily_target_cents" * "company_ad_campaigns"."duration_days"),
	CONSTRAINT "company_ad_campaigns_metrics_check" CHECK ("company_ad_campaigns"."spent_cents" >= 0 and "company_ad_campaigns"."impressions" >= 0 and "company_ad_campaigns"."clicks" >= 0 and "company_ad_campaigns"."landing_page_views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_ad_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"campaign_id" uuid,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_id" uuid,
	"provider_operation_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ad_receipts_type_check" CHECK ("company_ad_receipts"."type" in ('connected', 'synced', 'campaign_requested', 'campaign_launched', 'campaign_paused', 'campaign_resumed', 'campaign_completed', 'campaign_failed', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "company_ad_connections" ADD CONSTRAINT "company_ad_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_connections" ADD CONSTRAINT "company_ad_connections_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_connections" ADD CONSTRAINT "company_ad_connections_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_connection_id_company_ad_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."company_ad_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_website_id_company_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."company_websites"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_campaigns" ADD CONSTRAINT "company_ad_campaigns_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_connection_id_company_ad_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."company_ad_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_campaign_id_company_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."company_ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ad_receipts" ADD CONSTRAINT "company_ad_receipts_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_ad_connections_company_status_idx" ON "company_ad_connections" USING btree ("company_id","connection_status");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ad_connections_company_account_uq" ON "company_ad_connections" USING btree ("company_id","provider_key","external_ad_account_id");
--> statement-breakpoint
CREATE INDEX "company_ad_campaigns_company_status_idx" ON "company_ad_campaigns" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX "company_ad_campaigns_connection_created_idx" ON "company_ad_campaigns" USING btree ("connection_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ad_campaigns_connection_approval_uq" ON "company_ad_campaigns" USING btree ("connection_id","approval_id") WHERE "approval_id" is not null;
--> statement-breakpoint
CREATE INDEX "company_ad_receipts_company_occurred_idx" ON "company_ad_receipts" USING btree ("company_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "company_ad_receipts_connection_occurred_idx" ON "company_ad_receipts" USING btree ("connection_id","occurred_at");
