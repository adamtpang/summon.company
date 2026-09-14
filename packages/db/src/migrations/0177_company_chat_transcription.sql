ALTER TABLE "company_ai_gateways" ADD COLUMN "transcription_model" text;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD COLUMN "transcription_max_seconds" integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD COLUMN "transcription_monthly_microusd_limit" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD COLUMN "transcription_input_microusd_per_million_tokens" integer DEFAULT 1250000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD COLUMN "transcription_output_microusd_per_million_tokens" integer DEFAULT 5000000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_ai_gateways" ADD CONSTRAINT "company_ai_gateways_transcription_policy_check" CHECK (
  "transcription_max_seconds" between 15 and 120
  and "transcription_input_microusd_per_million_tokens" > 0
  and "transcription_output_microusd_per_million_tokens" > 0
  and (
    ("transcription_model" is null and "transcription_monthly_microusd_limit" = 0)
    or (
      "transcription_model" = 'gpt-4o-mini-transcribe-2025-12-15'
      and "transcription_monthly_microusd_limit" between 25000 and 100000000
    )
  )
);
--> statement-breakpoint
CREATE TABLE "company_ai_gateway_transcriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "gateway_id" uuid NOT NULL,
  "client_request_id" uuid NOT NULL,
  "status" text DEFAULT 'reserved' NOT NULL,
  "model" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "reserved_microusd" integer NOT NULL,
  "cost_microusd" integer DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "audio_input_tokens" integer DEFAULT 0 NOT NULL,
  "text_input_tokens" integer DEFAULT 0 NOT NULL,
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
  CONSTRAINT "company_ai_gateway_transcriptions_status_check" CHECK ("status" in ('reserved', 'in_progress', 'succeeded', 'failed', 'outcome_unknown')),
  CONSTRAINT "company_ai_gateway_transcriptions_usage_check" CHECK (
    "byte_size" between 1 and 12582912
    and "reserved_microusd" > 0
    and "cost_microusd" >= 0
    and "input_tokens" >= 0
    and "audio_input_tokens" >= 0
    and "text_input_tokens" >= 0
    and "output_tokens" >= 0
    and "total_tokens" >= 0
    and ("provider_status_code" is null or "provider_status_code" between 100 and 599)
    and ("latency_ms" is null or "latency_ms" >= 0)
  )
);
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_transcriptions" ADD CONSTRAINT "company_ai_gateway_transcriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_ai_gateway_transcriptions" ADD CONSTRAINT "company_ai_gateway_transcriptions_gateway_id_company_ai_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."company_ai_gateways"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "company_ai_gateway_transcriptions_gateway_request_uq" ON "company_ai_gateway_transcriptions" USING btree ("gateway_id", "client_request_id");
--> statement-breakpoint
CREATE INDEX "company_ai_gateway_transcriptions_company_gateway_created_idx" ON "company_ai_gateway_transcriptions" USING btree ("company_id", "gateway_id", "created_at");
--> statement-breakpoint
CREATE INDEX "company_ai_gateway_transcriptions_gateway_status_idx" ON "company_ai_gateway_transcriptions" USING btree ("gateway_id", "status", "created_at");
