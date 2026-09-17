import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CompanyAiGatewayKeyStatus,
  CompanyAiGatewayRequestStatus,
  CompanyAiGatewayStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyAiGateways = pgTable(
  "company_ai_gateways",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<CompanyAiGatewayStatus>()
      .notNull()
      .default("active"),
    provider: text("provider").notNull().default("openai"),
    credentialSecretId: uuid("credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    model: text("model").notNull(),
    maxInputCharacters: integer("max_input_characters").notNull(),
    maxOutputTokens: integer("max_output_tokens").notNull(),
    requestsPerMinute: integer("requests_per_minute").notNull(),
    maxConcurrentRequests: integer("max_concurrent_requests").notNull(),
    monthlyTokenLimit: integer("monthly_token_limit").notNull(),
    transcriptionModel: text("transcription_model"),
    transcriptionMaxSeconds: integer("transcription_max_seconds")
      .notNull()
      .default(60),
    transcriptionMonthlyMicrousdLimit: integer(
      "transcription_monthly_microusd_limit",
    )
      .notNull()
      .default(0),
    transcriptionInputMicrousdPerMillionTokens: integer(
      "transcription_input_microusd_per_million_tokens",
    )
      .notNull()
      .default(1_250_000),
    transcriptionOutputMicrousdPerMillionTokens: integer(
      "transcription_output_microusd_per_million_tokens",
    )
      .notNull()
      .default(5_000_000),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("company_ai_gateways_company_uq").on(table.companyId),
    companyStatusIdx: index("company_ai_gateways_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    statusCheck: check(
      "company_ai_gateways_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    providerCheck: check(
      "company_ai_gateways_provider_check",
      sql`${table.provider} = 'openai'`,
    ),
    limitsCheck: check(
      "company_ai_gateways_limits_check",
      sql`${table.maxInputCharacters} between 128 and 50000
        and ${table.maxOutputTokens} between 1 and 8192
        and ${table.requestsPerMinute} between 1 and 60
        and ${table.maxConcurrentRequests} between 1 and 5
        and ${table.monthlyTokenLimit} between 10000 and 100000000`,
    ),
    transcriptionPolicyCheck: check(
      "company_ai_gateways_transcription_policy_check",
      sql`${table.transcriptionMaxSeconds} between 15 and 120
        and ${table.transcriptionInputMicrousdPerMillionTokens} > 0
        and ${table.transcriptionOutputMicrousdPerMillionTokens} > 0
        and (
          (${table.transcriptionModel} is null and ${table.transcriptionMonthlyMicrousdLimit} = 0)
          or (
            ${table.transcriptionModel} = 'gpt-4o-mini-transcribe-2025-12-15'
            and ${table.transcriptionMonthlyMicrousdLimit} between 25000 and 100000000
          )
        )`,
    ),
  }),
);

export const companyAiGatewayKeys = pgTable(
  "company_ai_gateway_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => companyAiGateways.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    status: text("status")
      .$type<CompanyAiGatewayKeyStatus>()
      .notNull()
      .default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyHashUq: uniqueIndex("company_ai_gateway_keys_hash_uq").on(table.keyHash),
    companyGatewayIdx: index("company_ai_gateway_keys_company_gateway_idx").on(
      table.companyId,
      table.gatewayId,
      table.createdAt,
    ),
    statusCheck: check(
      "company_ai_gateway_keys_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
  }),
);

export const companyAiGatewayRequests = pgTable(
  "company_ai_gateway_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => companyAiGateways.id, { onDelete: "cascade" }),
    keyId: uuid("key_id")
      .notNull()
      .references(() => companyAiGatewayKeys.id, { onDelete: "restrict" }),
    clientRequestId: uuid("client_request_id").notNull(),
    status: text("status")
      .$type<CompanyAiGatewayRequestStatus>()
      .notNull()
      .default("reserved"),
    model: text("model").notNull(),
    reservedTokens: integer("reserved_tokens").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    providerStatusCode: integer("provider_status_code"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyRequestUq: uniqueIndex("company_ai_gateway_requests_key_request_uq").on(
      table.keyId,
      table.clientRequestId,
    ),
    companyGatewayCreatedIdx: index(
      "company_ai_gateway_requests_company_gateway_created_idx",
    ).on(table.companyId, table.gatewayId, table.createdAt),
    gatewayStatusIdx: index("company_ai_gateway_requests_gateway_status_idx").on(
      table.gatewayId,
      table.status,
      table.createdAt,
    ),
    statusCheck: check(
      "company_ai_gateway_requests_status_check",
      sql`${table.status} in ('reserved', 'in_progress', 'succeeded', 'failed', 'outcome_unknown')`,
    ),
    usageCheck: check(
      "company_ai_gateway_requests_usage_check",
      sql`${table.reservedTokens} > 0
        and ${table.inputTokens} >= 0
        and ${table.outputTokens} >= 0
        and ${table.totalTokens} >= 0
        and (${table.providerStatusCode} is null or ${table.providerStatusCode} between 100 and 599)
        and (${table.latencyMs} is null or ${table.latencyMs} >= 0)`,
    ),
  }),
);

export const companyAiGatewayTranscriptions = pgTable(
  "company_ai_gateway_transcriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => companyAiGateways.id, { onDelete: "cascade" }),
    clientRequestId: uuid("client_request_id").notNull(),
    status: text("status")
      .$type<CompanyAiGatewayRequestStatus>()
      .notNull()
      .default("reserved"),
    model: text("model").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    reservedMicrousd: integer("reserved_microusd").notNull(),
    costMicrousd: integer("cost_microusd").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    audioInputTokens: integer("audio_input_tokens").notNull().default(0),
    textInputTokens: integer("text_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    providerStatusCode: integer("provider_status_code"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    gatewayRequestUq: uniqueIndex(
      "company_ai_gateway_transcriptions_gateway_request_uq",
    ).on(table.gatewayId, table.clientRequestId),
    companyGatewayCreatedIdx: index(
      "company_ai_gateway_transcriptions_company_gateway_created_idx",
    ).on(table.companyId, table.gatewayId, table.createdAt),
    gatewayStatusIdx: index(
      "company_ai_gateway_transcriptions_gateway_status_idx",
    ).on(table.gatewayId, table.status, table.createdAt),
    statusCheck: check(
      "company_ai_gateway_transcriptions_status_check",
      sql`${table.status} in ('reserved', 'in_progress', 'succeeded', 'failed', 'outcome_unknown')`,
    ),
    usageCheck: check(
      "company_ai_gateway_transcriptions_usage_check",
      sql`${table.byteSize} between 1 and 12582912
        and ${table.reservedMicrousd} > 0
        and ${table.costMicrousd} >= 0
        and ${table.inputTokens} >= 0
        and ${table.audioInputTokens} >= 0
        and ${table.textInputTokens} >= 0
        and ${table.outputTokens} >= 0
        and ${table.totalTokens} >= 0
        and (${table.providerStatusCode} is null or ${table.providerStatusCode} between 100 and 599)
        and (${table.latencyMs} is null or ${table.latencyMs} >= 0)`,
    ),
  }),
);
