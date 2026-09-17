import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
  CompanyPaymentConnectionStatus,
  CompanyPaymentMode,
  CompanyPaymentDisputeStatus,
  CompanyPaymentOfferKind,
  CompanyPaymentOfferStatus,
  CompanyPaymentOperationsStatus,
  CompanyPaymentReceiptType,
  CompanyPaymentRevenueSyncStatus,
  CompanyPaymentRefundReason,
  CompanyPaymentRefundStatus,
  CompanyPaymentWebhookStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyPaymentAccounts = pgTable(
  "company_payment_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name").notNull(),
    ownerAgentId: uuid("owner_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
    credentialSecretId: uuid("credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    webhookPublicId: uuid("webhook_public_id").notNull().defaultRandom(),
    webhookSigningSecretId: uuid("webhook_signing_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    webhookStatus: text("webhook_status").$type<CompanyPaymentWebhookStatus>().notNull().default("unconfigured"),
    webhookConfiguredAt: timestamp("webhook_configured_at", { withTimezone: true }),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
    lastWebhookError: text("last_webhook_error"),
    operationsCredentialSecretId: uuid("operations_credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    operationsStatus: text("operations_status")
      .$type<CompanyPaymentOperationsStatus>()
      .notNull()
      .default("unconfigured"),
    operationsConfiguredAt: timestamp("operations_configured_at", { withTimezone: true }),
    lastOperationsSyncedAt: timestamp("last_operations_synced_at", { withTimezone: true }),
    lastOperationsError: text("last_operations_error"),
    connectionStatus: text("connection_status").$type<CompanyPaymentConnectionStatus>().notNull().default("connected"),
    mode: text("mode").$type<CompanyPaymentMode>().notNull(),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    country: text("country"),
    defaultCurrency: text("default_currency"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    recentPaymentCount: integer("recent_payment_count").notNull().default(0),
    recentGrossCents: bigint("recent_gross_cents", { mode: "number" }).notNull().default(0),
    recentCurrency: text("recent_currency"),
    activeSubscriptionCount: integer("active_subscription_count").notNull().default(0),
    recentCustomerCount: integer("recent_customer_count").notNull().default(0),
    recentRefundCount: integer("recent_refund_count").notNull().default(0),
    recentRefundedCents: bigint("recent_refunded_cents", { mode: "number" }).notNull().default(0),
    openDisputeCount: integer("open_dispute_count").notNull().default(0),
    openDisputedCents: bigint("open_disputed_cents", { mode: "number" }).notNull().default(0),
    lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    revenueSyncStatus: text("revenue_sync_status")
      .$type<CompanyPaymentRevenueSyncStatus>()
      .notNull()
      .default("idle"),
    nextRevenueSyncAt: timestamp("next_revenue_sync_at", { withTimezone: true }).defaultNow(),
    revenueSyncStartedAt: timestamp("revenue_sync_started_at", { withTimezone: true }),
    revenueSyncFailureCount: integer("revenue_sync_failure_count").notNull().default(0),
    lastRevenueSyncError: text("last_revenue_sync_error"),
    revenueSnapshotFingerprint: text("revenue_snapshot_fingerprint"),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_payment_accounts_company_status_idx").on(table.companyId, table.connectionStatus),
    companyProviderAccountUq: uniqueIndex("company_payment_accounts_provider_account_uq").on(
      table.companyId,
      table.providerKey,
      table.externalAccountId,
    ),
    webhookPublicIdUq: uniqueIndex("company_payment_accounts_webhook_public_id_uq").on(table.webhookPublicId),
    revenueSyncDueIdx: index("company_payment_accounts_revenue_sync_due_idx")
      .on(table.revenueSyncStatus, table.nextRevenueSyncAt)
      .where(sql`${table.nextRevenueSyncAt} is not null and ${table.revenueSyncStatus} in ('idle', 'retrying')`),
    connectionStatusCheck: check(
      "company_payment_accounts_connection_status_check",
      sql`${table.connectionStatus} in ('connected', 'error', 'revoked')`,
    ),
    modeCheck: check("company_payment_accounts_mode_check", sql`${table.mode} in ('test', 'live')`),
    webhookStatusCheck: check(
      "company_payment_accounts_webhook_status_check",
      sql`${table.webhookStatus} in ('unconfigured', 'active', 'error', 'revoked')`,
    ),
    operationsStatusCheck: check(
      "company_payment_accounts_operations_status_check",
      sql`${table.operationsStatus} in ('unconfigured', 'ready', 'error', 'revoked')`,
    ),
    revenueSyncStatusCheck: check(
      "company_payment_accounts_revenue_sync_status_check",
      sql`${table.revenueSyncStatus} in ('idle', 'processing', 'retrying', 'error', 'revoked')`,
    ),
    revenueSyncFailureCountCheck: check(
      "company_payment_accounts_revenue_sync_failure_count_check",
      sql`${table.revenueSyncFailureCount} >= 0`,
    ),
    revenueSnapshotFingerprintCheck: check(
      "company_payment_accounts_revenue_snapshot_fingerprint_check",
      sql`${table.revenueSnapshotFingerprint} is null or ${table.revenueSnapshotFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    nonNegativeMetricsCheck: check(
      "company_payment_accounts_nonnegative_metrics_check",
      sql`${table.recentPaymentCount} >= 0 and ${table.recentGrossCents} >= 0 and ${table.activeSubscriptionCount} >= 0 and ${table.recentCustomerCount} >= 0 and ${table.recentRefundCount} >= 0 and ${table.recentRefundedCents} >= 0 and ${table.openDisputeCount} >= 0 and ${table.openDisputedCents} >= 0`,
    ),
  }),
);

export const companyPaymentOffers = pgTable(
  "company_payment_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => companyPaymentAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind").$type<CompanyPaymentOfferKind>().notNull(),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    currency: text("currency").notNull(),
    interval: text("interval"),
    allowPromotionCodes: boolean("allow_promotion_codes").notNull().default(false),
    automaticTax: boolean("automatic_tax").notNull().default(false),
    status: text("status").$type<CompanyPaymentOfferStatus>().notNull(),
    externalProductId: text("external_product_id"),
    externalPriceId: text("external_price_id"),
    externalPaymentLinkId: text("external_payment_link_id"),
    paymentUrl: text("payment_url"),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    providerOperationId: text("provider_operation_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("company_payment_offers_company_created_idx").on(table.companyId, table.createdAt),
    accountStatusIdx: index("company_payment_offers_account_status_idx").on(table.accountId, table.status),
    accountPaymentLinkUq: uniqueIndex("company_payment_offers_account_payment_link_uq")
      .on(table.accountId, table.externalPaymentLinkId)
      .where(sql`${table.externalPaymentLinkId} is not null`),
    accountApprovalUq: uniqueIndex("company_payment_offers_account_approval_uq")
      .on(table.accountId, table.approvalId)
      .where(sql`${table.approvalId} is not null`),
    kindCheck: check("company_payment_offers_kind_check", sql`${table.kind} in ('one_time', 'subscription')`),
    intervalCheck: check(
      "company_payment_offers_interval_check",
      sql`(${table.kind} = 'one_time' and ${table.interval} is null) or (${table.kind} = 'subscription' and ${table.interval} in ('month', 'year'))`,
    ),
    statusCheck: check(
      "company_payment_offers_status_check",
      sql`${table.status} in ('awaiting_approval', 'executing', 'active', 'inactive', 'failed', 'outcome_unknown')`,
    ),
    amountCheck: check("company_payment_offers_amount_check", sql`${table.unitAmountCents} > 0`),
  }),
);

export const companyPaymentReceipts = pgTable(
  "company_payment_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => companyPaymentAccounts.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").references(() => companyPaymentOffers.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyPaymentReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    providerOperationId: text("provider_operation_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("company_payment_receipts_company_occurred_idx").on(table.companyId, table.occurredAt),
    accountOccurredIdx: index("company_payment_receipts_account_occurred_idx").on(table.accountId, table.occurredAt),
    typeCheck: check(
      "company_payment_receipts_type_check",
      sql`${table.type} in ('connected', 'synced', 'payment_link_requested', 'payment_link_created', 'payment_link_failed', 'payment_link_reconciled', 'payment_link_deactivated', 'webhook_configured', 'checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped', 'operations_configured', 'operations_synced', 'refund_requested', 'refund_succeeded', 'refund_pending', 'refund_failed', 'refund_outcome_unknown', 'refund_webhook_reconciled', 'dispute_webhook_reconciled', 'revenue_auto_synced', 'revenue_auto_sync_failed', 'revoked')`,
    ),
    checkoutSessionTypeUq: uniqueIndex("company_payment_receipts_checkout_session_type_uq")
      .on(table.accountId, table.type, table.providerOperationId)
      .where(sql`${table.providerOperationId} is not null and ${table.type} in ('checkout_paid', 'checkout_payment_pending', 'checkout_payment_failed', 'checkout_unmapped')`),
    webhookEventTypeUq: uniqueIndex("company_payment_receipts_webhook_event_type_uq")
      .on(table.accountId, table.type, table.providerOperationId)
      .where(sql`${table.providerOperationId} is not null and ${table.type} in ('refund_webhook_reconciled', 'dispute_webhook_reconciled')`),
  }),
);

export const companyPaymentRefunds = pgTable(
  "company_payment_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => companyPaymentAccounts.id, { onDelete: "cascade" }),
    paymentReceiptId: uuid("payment_receipt_id").notNull().references(() => companyPaymentReceipts.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    status: text("status").$type<CompanyPaymentRefundStatus>().notNull(),
    reason: text("reason").$type<CompanyPaymentRefundReason>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    externalCheckoutSessionId: text("external_checkout_session_id").notNull(),
    externalPaymentIntentId: text("external_payment_intent_id"),
    externalRefundId: text("external_refund_id"),
    providerOperationId: text("provider_operation_id").notNull(),
    requestedByUserId: text("requested_by_user_id").notNull(),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountCreatedIdx: index("company_payment_refunds_account_created_idx").on(table.accountId, table.createdAt),
    accountRequestUq: uniqueIndex("company_payment_refunds_account_request_uq").on(table.accountId, table.requestId),
    accountExternalRefundUq: uniqueIndex("company_payment_refunds_account_external_refund_uq")
      .on(table.accountId, table.externalRefundId)
      .where(sql`${table.externalRefundId} is not null`),
    statusCheck: check(
      "company_payment_refunds_status_check",
      sql`${table.status} in ('submitting', 'pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'outcome_unknown')`,
    ),
    reasonCheck: check(
      "company_payment_refunds_reason_check",
      sql`${table.reason} in ('duplicate', 'requested_by_customer')`,
    ),
    amountCheck: check("company_payment_refunds_amount_check", sql`${table.amountCents} > 0`),
  }),
);

export const companyPaymentDisputes = pgTable(
  "company_payment_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => companyPaymentAccounts.id, { onDelete: "cascade" }),
    externalDisputeId: text("external_dispute_id").notNull(),
    status: text("status").$type<CompanyPaymentDisputeStatus>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    dueBy: timestamp("due_by", { withTimezone: true }),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountStatusIdx: index("company_payment_disputes_account_status_idx").on(table.accountId, table.status),
    accountExternalUq: uniqueIndex("company_payment_disputes_account_external_uq").on(table.accountId, table.externalDisputeId),
    statusCheck: check(
      "company_payment_disputes_status_check",
      sql`${table.status} in ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost', 'prevented')`,
    ),
    amountCheck: check("company_payment_disputes_amount_check", sql`${table.amountCents} >= 0`),
  }),
);
