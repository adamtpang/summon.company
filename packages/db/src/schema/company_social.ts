import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type {
  CompanySocialChannelStatus,
  CompanySocialAnalyticsSnapshot,
  CompanySocialAnalyticsStatus,
  CompanySocialConnectionStatus,
  CompanySocialPlatformResult,
  CompanySocialMediaSnapshot,
  CompanySocialPostStatus,
  CompanySocialReceiptType,
  CompanySocialTargetSnapshot,
  CompanySocialWebhookStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companySocialConnections = pgTable(
  "company_social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalProfileId: text("external_profile_id").notNull(),
    displayName: text("display_name").notNull(),
    ownerAgentId: uuid("owner_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
    credentialSecretId: uuid("credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    webhookSecretId: uuid("webhook_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    providerWebhookId: text("provider_webhook_id"),
    webhookStatus: text("webhook_status").$type<CompanySocialWebhookStatus>().notNull().default("unconfigured"),
    webhookVerifiedAt: timestamp("webhook_verified_at", { withTimezone: true }),
    webhookLastEventAt: timestamp("webhook_last_event_at", { withTimezone: true }),
    webhookLastError: text("webhook_last_error"),
    connectionStatus: text("connection_status").$type<CompanySocialConnectionStatus>().notNull().default("connected"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_social_connections_company_status_idx").on(table.companyId, table.connectionStatus),
    companyProviderProfileUq: uniqueIndex("company_social_connections_provider_profile_uq").on(
      table.companyId,
      table.providerKey,
      table.externalProfileId,
    ),
    providerWebhookUq: uniqueIndex("company_social_connections_provider_webhook_uq")
      .on(table.companyId, table.providerKey, table.providerWebhookId)
      .where(sql`${table.providerWebhookId} is not null`),
    statusCheck: check(
      "company_social_connections_status_check",
      sql`${table.connectionStatus} in ('connected', 'error', 'revoked')`,
    ),
    webhookStatusCheck: check(
      "company_social_connections_webhook_status_check",
      sql`${table.webhookStatus} in ('unconfigured', 'provisioning', 'verified', 'error', 'revoked')`,
    ),
  }),
);

export const companySocialChannels = pgTable(
  "company_social_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companySocialConnections.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    platform: text("platform").notNull(),
    username: text("username"),
    displayName: text("display_name").notNull(),
    profileUrl: text("profile_url"),
    status: text("status").$type<CompanySocialChannelStatus>().notNull().default("connected"),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectionStatusIdx: index("company_social_channels_connection_status_idx").on(table.connectionId, table.status),
    companyPlatformIdx: index("company_social_channels_company_platform_idx").on(table.companyId, table.platform),
    connectionProviderAccountUq: uniqueIndex("company_social_channels_connection_account_uq").on(
      table.connectionId,
      table.providerAccountId,
    ),
    statusCheck: check("company_social_channels_status_check", sql`${table.status} in ('connected', 'disconnected')`),
  }),
);

export const companySocialPosts = pgTable(
  "company_social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companySocialConnections.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: text("status").$type<CompanySocialPostStatus>().notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    timezone: text("timezone").notNull().default("UTC"),
    targetChannelIds: jsonb("target_channel_ids").$type<string[]>().notNull().default([]),
    targetSnapshot: jsonb("target_snapshot").$type<CompanySocialTargetSnapshot[]>().notNull().default([]),
    mediaSnapshot: jsonb("media_snapshot").$type<CompanySocialMediaSnapshot[]>().notNull().default([]),
    externalPostId: text("external_post_id"),
    platformResults: jsonb("platform_results").$type<CompanySocialPlatformResult[]>().notNull().default([]),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    providerOperationId: text("provider_operation_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    analytics: jsonb("analytics").$type<CompanySocialAnalyticsSnapshot>(),
    analyticsStatus: text("analytics_status").$type<CompanySocialAnalyticsStatus>().notNull().default("not_requested"),
    analyticsLastAttemptAt: timestamp("analytics_last_attempt_at", { withTimezone: true }),
    analyticsUpdatedAt: timestamp("analytics_updated_at", { withTimezone: true }),
    analyticsNextRefreshAt: timestamp("analytics_next_refresh_at", { withTimezone: true }),
    analyticsLastError: text("analytics_last_error"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    deleteRequestId: uuid("delete_request_id"),
    deletePreviousStatus: text("delete_previous_status").$type<"published" | "partial">(),
    deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectionCreatedIdx: index("company_social_posts_connection_created_idx").on(table.connectionId, table.createdAt),
    companyStatusIdx: index("company_social_posts_company_status_idx").on(table.companyId, table.status),
    analyticsDueIdx: index("company_social_posts_analytics_due_idx").on(table.analyticsStatus, table.analyticsNextRefreshAt),
    connectionExternalPostUq: uniqueIndex("company_social_posts_connection_external_post_uq")
      .on(table.connectionId, table.externalPostId)
      .where(sql`${table.externalPostId} is not null`),
    connectionApprovalUq: uniqueIndex("company_social_posts_connection_approval_uq")
      .on(table.connectionId, table.approvalId)
      .where(sql`${table.approvalId} is not null`),
    connectionDeleteRequestUq: uniqueIndex("company_social_posts_connection_delete_request_uq")
      .on(table.connectionId, table.deleteRequestId)
      .where(sql`${table.deleteRequestId} is not null`),
    statusCheck: check(
      "company_social_posts_status_check",
      sql`${table.status} in ('awaiting_approval', 'executing', 'submitted', 'scheduled', 'published', 'partial', 'deleting', 'deleted', 'deletion_outcome_unknown', 'failed', 'cancelled', 'outcome_unknown')`,
    ),
    deletePreviousStatusCheck: check(
      "company_social_posts_delete_previous_status_check",
      sql`${table.deletePreviousStatus} is null or ${table.deletePreviousStatus} in ('published', 'partial')`,
    ),
    analyticsStatusCheck: check(
      "company_social_posts_analytics_status_check",
      sql`${table.analyticsStatus} in ('not_requested', 'pending', 'fresh', 'unavailable', 'error')`,
    ),
  }),
);

export const companySocialReceipts = pgTable(
  "company_social_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companySocialConnections.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => companySocialPosts.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanySocialReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    providerOperationId: text("provider_operation_id"),
    providerEventId: text("provider_event_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("company_social_receipts_company_occurred_idx").on(table.companyId, table.occurredAt),
    connectionOccurredIdx: index("company_social_receipts_connection_occurred_idx").on(table.connectionId, table.occurredAt),
    connectionProviderEventUq: uniqueIndex("company_social_receipts_connection_provider_event_uq")
      .on(table.connectionId, table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    typeCheck: check(
      "company_social_receipts_type_check",
      sql`${table.type} in ('connected', 'synced', 'post_requested', 'post_submitted', 'post_scheduled', 'post_published', 'post_failed', 'post_cancelled', 'post_delete_requested', 'post_deleted', 'post_delete_failed', 'post_delete_outcome_unknown', 'post_delete_reconciled', 'post_reconciled', 'post_webhook_reconciled', 'post_analytics_refreshed', 'webhook_verified', 'revoked')`,
    ),
  }),
);

export const companySocialWebhookEvents = pgTable(
  "company_social_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companySocialConnections.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    providerEventType: text("provider_event_type").notNull(),
    providerPostId: text("provider_post_id"),
    localPostId: text("local_post_id"),
    status: text("status").$type<"pending" | "processing" | "retrying" | "processed" | "ignored" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectionEventUq: uniqueIndex("company_social_webhook_events_connection_event_uq")
      .on(table.connectionId, table.providerEventId),
    dueIdx: index("company_social_webhook_events_due_idx").on(table.status, table.nextAttemptAt),
    companyOccurredIdx: index("company_social_webhook_events_company_occurred_idx").on(table.companyId, table.occurredAt),
    statusCheck: check(
      "company_social_webhook_events_status_check",
      sql`${table.status} in ('pending', 'processing', 'retrying', 'processed', 'ignored', 'failed')`,
    ),
    attemptsCheck: check("company_social_webhook_events_attempts_check", sql`${table.attempts} >= 0`),
  }),
);
