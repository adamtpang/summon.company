CREATE TABLE IF NOT EXISTS "adapter_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"billing_model" text DEFAULT 'subscription' NOT NULL,
	"unit" text DEFAULT 'normalized_units' NOT NULL,
	"routes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"allowed_adapters_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_budget_units" integer,
	"unit" text DEFAULT 'normalized_units' NOT NULL,
	"capability_scopes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"credential_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"metadata_json" jsonb,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"credential_id" uuid,
	"policy_id" uuid,
	"run_id" text,
	"issue_id" uuid,
	"heartbeat_run_id" uuid,
	"reservation_id" uuid,
	"adapter_key" text NOT NULL,
	"model" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text DEFAULT 'normalized_units' NOT NULL,
	"units" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"cost_event_id" uuid,
	"description" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_policies" ADD CONSTRAINT "employee_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_policies" ADD CONSTRAINT "employee_policies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_policy_id_employee_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."employee_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_credential_id_employee_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."employee_credentials"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_policy_id_employee_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."employee_policies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cost_ledger_entries" ADD CONSTRAINT "cost_ledger_entries_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "adapter_manifests_key_unique_idx" ON "adapter_manifests" USING btree ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adapter_manifests_active_idx" ON "adapter_manifests" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_policies_company_agent_idx" ON "employee_policies" USING btree ("company_id","agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_policies_company_agent_active_unique_idx" ON "employee_policies" USING btree ("company_id","agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_credentials_hash_idx" ON "employee_credentials" USING btree ("credential_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_credentials_company_agent_idx" ON "employee_credentials" USING btree ("company_id","agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_credentials_prefix_idx" ON "employee_credentials" USING btree ("prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_company_agent_occurred_idx" ON "cost_ledger_entries" USING btree ("company_id","agent_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_agent_kind_idx" ON "cost_ledger_entries" USING btree ("agent_id","kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_run_idx" ON "cost_ledger_entries" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_reservation_idx" ON "cost_ledger_entries" USING btree ("reservation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_credential_idx" ON "cost_ledger_entries" USING btree ("credential_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_ledger_entries_cost_event_idx" ON "cost_ledger_entries" USING btree ("cost_event_id");
