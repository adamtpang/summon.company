CREATE TABLE IF NOT EXISTS "pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"bundled_usage_cents" integer DEFAULT 0 NOT NULL,
	"overage_markup_bps" integer DEFAULT 0 NOT NULL,
	"outcome_metric" text,
	"outcome_rate_bps" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cap_cents" integer,
	"hard_stop_enabled" boolean DEFAULT true NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"anchor_day" integer,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"metadata_json" jsonb,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"agent_id" uuid,
	"issue_id" uuid,
	"heartbeat_run_id" uuid,
	"cost_event_id" uuid,
	"description" text,
	"period_start" timestamp with time zone NOT NULL,
	"unit" text DEFAULT 'usd_cogs' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cogs_cents" integer NOT NULL,
	"bundled_cents" integer DEFAULT 0 NOT NULL,
	"overage_cogs_cents" integer DEFAULT 0 NOT NULL,
	"markup_bps" integer DEFAULT 0 NOT NULL,
	"billed_cents" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outcome_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subscription_id" uuid,
	"agent_id" uuid,
	"issue_id" uuid,
	"issue_outcome_id" uuid,
	"metric" text NOT NULL,
	"basis_cents" integer NOT NULL,
	"rate_bps" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"direction" text DEFAULT 'credit' NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"period_start" timestamp with time zone,
	"metadata_json" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_plan_id_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_subscription_id_company_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."company_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outcome_commissions" ADD CONSTRAINT "outcome_commissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outcome_commissions" ADD CONSTRAINT "outcome_commissions_subscription_id_company_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."company_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outcome_commissions" ADD CONSTRAINT "outcome_commissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outcome_commissions" ADD CONSTRAINT "outcome_commissions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outcome_commissions" ADD CONSTRAINT "outcome_commissions_issue_outcome_id_issue_outcomes_id_fk" FOREIGN KEY ("issue_outcome_id") REFERENCES "public"."issue_outcomes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_plans_company_active_idx" ON "pricing_plans" USING btree ("company_id","is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_plans_company_key_unique_idx" ON "pricing_plans" USING btree ("company_id","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_subscriptions_company_status_idx" ON "company_subscriptions" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_subscriptions_plan_idx" ON "company_subscriptions" USING btree ("plan_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_subscriptions_company_active_unique_idx" ON "company_subscriptions" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_usage_records_company_period_idx" ON "subscription_usage_records" USING btree ("company_id","period_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_usage_records_subscription_period_idx" ON "subscription_usage_records" USING btree ("subscription_id","period_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_usage_records_company_occurred_idx" ON "subscription_usage_records" USING btree ("company_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_usage_records_cost_event_idx" ON "subscription_usage_records" USING btree ("cost_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outcome_commissions_company_occurred_idx" ON "outcome_commissions" USING btree ("company_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outcome_commissions_company_status_idx" ON "outcome_commissions" USING btree ("company_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outcome_commissions_agent_idx" ON "outcome_commissions" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outcome_commissions_issue_outcome_idx" ON "outcome_commissions" USING btree ("issue_outcome_id");
