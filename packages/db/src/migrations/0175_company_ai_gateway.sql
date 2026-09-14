CREATE TABLE "company_ai_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"credential_secret_id" uuid,
	"model" text NOT NULL,
	"max_input_characters" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"requests_per_minute" integer NOT NULL,
	"max_concurrent_requests" integer NOT NULL,
	"monthly_token_limit" integer NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ai_gateways_status_check" CHECK ("company_ai_gateways"."status" in ('active', 'revoked')),
	CONSTRAINT "company_ai_gateways_provider_check" CHECK ("company_ai_gateways"."provider" = 'openai'),
	CONSTRAINT "company_ai_gateways_limits_check" CHECK ("company_ai_gateways"."max_input_characters" between 128 and 50000
        and "company_ai_gateways"."max_output_tokens" between 1 and 8192
        and "company_ai_gateways"."requests_per_minute" between 1 and 60
        and "company_ai_gateways"."max_concurrent_requests" between 1 and 5
        and "company_ai_gateways"."monthly_token_limit" between 10000 and 100000000)
);
--> statement-breakpoint
CREATE TABLE "company_ai_gateway_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"gateway_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ai_gateway_keys_status_check" CHECK ("company_ai_gateway_keys"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "company_ai_gateway_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"gateway_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"model" text NOT NULL,
	"reserved_tokens" integer NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"provider_request_id" text,
	"provider_status_code" integer,
	"latency_ms" integer,
	"error_code" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_ai_gateway_requests_status_check" CHECK ("company_ai_gateway_requests"."status" in ('reserved', 'in_progress', 'succeeded', 'failed', 'outcome_unknown')),
	CONSTRAINT "company_ai_gateway_requests_usage_check" CHECK ("company_ai_gateway_requests"."reserved_tokens" > 0
        and "company_ai_gateway_requests"."input_tokens" >= 0
        and "company_ai_gateway_requests"."output_tokens" >= 0
        and "company_ai_gateway_requests"."total_tokens" >= 0
        and ("company_ai_gateway_requests"."provider_status_code" is null or "company_ai_gateway_requests"."provider_status_code" between 100 and 599)
        and ("company_ai_gateway_requests"."latency_ms" is null or "company_ai_gateway_requests"."latency_ms" >= 0))
);
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD CONSTRAINT "company_ai_gateways_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD CONSTRAINT "company_ai_gateways_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD CONSTRAINT "company_ai_gateways_credential_secret_id_company_secrets_id_fk" FOREIGN KEY ("credential_secret_id") REFERENCES "public"."company_secrets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_keys" ADD CONSTRAINT "company_ai_gateway_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_keys" ADD CONSTRAINT "company_ai_gateway_keys_gateway_id_company_ai_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."company_ai_gateways"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_requests" ADD CONSTRAINT "company_ai_gateway_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_requests" ADD CONSTRAINT "company_ai_gateway_requests_gateway_id_company_ai_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."company_ai_gateways"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_requests" ADD CONSTRAINT "company_ai_gateway_requests_key_id_company_ai_gateway_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."company_ai_gateway_keys"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ai_gateways_company_uq" ON "company_ai_gateways" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "company_ai_gateways_company_status_idx" ON "company_ai_gateways" USING btree ("company_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ai_gateway_keys_hash_uq" ON "company_ai_gateway_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX "company_ai_gateway_keys_company_gateway_idx" ON "company_ai_gateway_keys" USING btree ("company_id","gateway_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ai_gateway_requests_key_request_uq" ON "company_ai_gateway_requests" USING btree ("key_id","client_request_id");
--> statement-breakpoint
CREATE INDEX "company_ai_gateway_requests_company_gateway_created_idx" ON "company_ai_gateway_requests" USING btree ("company_id","gateway_id","created_at");
--> statement-breakpoint
CREATE INDEX "company_ai_gateway_requests_gateway_status_idx" ON "company_ai_gateway_requests" USING btree ("gateway_id","status","created_at");
