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
  CompanyAdCampaignStatus,
  CompanyAdCallToAction,
  CompanyAdConnectionStatus,
  CompanyAdReceiptType,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";
import { companyWebsites } from "./company_website.js";

export const companyAdConnections = pgTable(
  "company_ad_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalAdAccountId: text("external_ad_account_id").notNull(),
    displayName: text("display_name").notNull(),
    externalPageId: text("external_page_id").notNull(),
    pageName: text("page_name").notNull(),
    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    credentialSecretId: uuid("credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    connectionStatus: text("connection_status")
      .$type<CompanyAdConnectionStatus>()
      .notNull()
      .default("connected"),
    currency: text("currency").notNull(),
    timezoneName: text("timezone_name").notNull(),
    externalAccountStatus: integer("external_account_status").notNull(),
    grantedScopes: jsonb("granted_scopes")
      .$type<string[]>()
      .notNull()
      .default([]),
    spendCapCents: integer("spend_cap_cents"),
    balanceCents: integer("balance_cents"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
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
    companyStatusIdx: index("company_ad_connections_company_status_idx").on(
      table.companyId,
      table.connectionStatus,
    ),
    companyAccountUq: uniqueIndex(
      "company_ad_connections_company_account_uq",
    ).on(table.companyId, table.providerKey, table.externalAdAccountId),
    statusCheck: check(
      "company_ad_connections_status_check",
      sql`${table.connectionStatus} in ('connected', 'error', 'revoked')`,
    ),
    currencyCheck: check(
      "company_ad_connections_currency_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    nonnegativeMoneyCheck: check(
      "company_ad_connections_nonnegative_money_check",
      sql`(${table.spendCapCents} is null or ${table.spendCapCents} >= 0) and (${table.balanceCents} is null or ${table.balanceCents} >= 0)`,
    ),
  }),
);

export const companyAdCampaigns = pgTable(
  "company_ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => companyAdConnections.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => companyWebsites.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    objective: text("objective").notNull().default("OUTCOME_TRAFFIC"),
    status: text("status").$type<CompanyAdCampaignStatus>().notNull(),
    destinationUrl: text("destination_url").notNull(),
    primaryText: text("primary_text").notNull(),
    headline: text("headline").notNull(),
    description: text("description"),
    callToAction: text("call_to_action")
      .$type<CompanyAdCallToAction>()
      .notNull(),
    imageHash: text("image_hash").notNull(),
    countries: jsonb("countries").$type<string[]>().notNull(),
    ageMin: integer("age_min").notNull(),
    ageMax: integer("age_max").notNull(),
    dailyTargetCents: integer("daily_target_cents").notNull(),
    durationDays: integer("duration_days").notNull(),
    lifetimeBudgetCents: integer("lifetime_budget_cents").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    externalCampaignId: text("external_campaign_id"),
    externalAdSetId: text("external_ad_set_id"),
    externalCreativeId: text("external_creative_id"),
    externalAdId: text("external_ad_id"),
    approvalId: uuid("approval_id").references(() => approvals.id, {
      onDelete: "set null",
    }),
    providerOperationId: text("provider_operation_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id"),
    spentCents: integer("spent_cents").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    landingPageViews: integer("landing_page_views").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deleteRequestId: uuid("delete_request_id"),
    deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_ad_campaigns_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    connectionCreatedIdx: index(
      "company_ad_campaigns_connection_created_idx",
    ).on(table.connectionId, table.createdAt),
    connectionApprovalUq: uniqueIndex(
      "company_ad_campaigns_connection_approval_uq",
    )
      .on(table.connectionId, table.approvalId)
      .where(sql`${table.approvalId} is not null`),
    connectionDeleteRequestUq: uniqueIndex(
      "company_ad_campaigns_connection_delete_request_uq",
    )
      .on(table.connectionId, table.deleteRequestId)
      .where(sql`${table.deleteRequestId} is not null`),
    statusCheck: check(
      "company_ad_campaigns_status_check",
      sql`${table.status} in ('awaiting_approval', 'provisioning', 'active', 'paused', 'completed', 'deleting', 'deleted', 'deletion_outcome_unknown', 'outcome_unknown', 'failed')`,
    ),
    objectiveCheck: check(
      "company_ad_campaigns_objective_check",
      sql`${table.objective} = 'OUTCOME_TRAFFIC'`,
    ),
    ctaCheck: check(
      "company_ad_campaigns_cta_check",
      sql`${table.callToAction} in ('LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'SHOP_NOW')`,
    ),
    audienceCheck: check(
      "company_ad_campaigns_audience_check",
      sql`${table.ageMin} between 18 and 65 and ${table.ageMax} between ${table.ageMin} and 65`,
    ),
    budgetCheck: check(
      "company_ad_campaigns_budget_check",
      sql`${table.dailyTargetCents} between 1000 and 100000 and ${table.durationDays} between 1 and 30 and ${table.lifetimeBudgetCents} = ${table.dailyTargetCents} * ${table.durationDays}`,
    ),
    metricsCheck: check(
      "company_ad_campaigns_metrics_check",
      sql`${table.spentCents} >= 0 and ${table.impressions} >= 0 and ${table.clicks} >= 0 and ${table.landingPageViews} >= 0`,
    ),
  }),
);

export const companyAdReceipts = pgTable(
  "company_ad_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => companyAdConnections.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => companyAdCampaigns.id, {
      onDelete: "cascade",
    }),
    type: text("type").$type<CompanyAdReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    approvalId: uuid("approval_id").references(() => approvals.id, {
      onDelete: "set null",
    }),
    providerOperationId: text("provider_operation_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("company_ad_receipts_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
    connectionOccurredIdx: index(
      "company_ad_receipts_connection_occurred_idx",
    ).on(table.connectionId, table.occurredAt),
    typeCheck: check(
      "company_ad_receipts_type_check",
      sql`${table.type} in ('connected', 'synced', 'campaign_requested', 'campaign_launched', 'campaign_paused', 'campaign_resumed', 'campaign_completed', 'campaign_delete_requested', 'campaign_deleted', 'campaign_delete_failed', 'campaign_delete_outcome_unknown', 'campaign_delete_reconciled', 'campaign_failed', 'revoked')`,
    ),
  }),
);
