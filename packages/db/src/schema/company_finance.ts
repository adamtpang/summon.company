import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import type {
  CompanyFinanceConnectionStatus,
  CompanyFinanceEnvironment,
  CompanyFinanceProviderKey,
  CompanyFinanceReceiptType,
  CompanyFinanceRevocationStatus,
  CompanyFinanceSyncCoverage,
  CompanyFinanceSyncStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyFinanceConnections = pgTable(
  "company_finance_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").$type<CompanyFinanceProviderKey>().notNull(),
    environment: text("environment").$type<CompanyFinanceEnvironment>().notNull(),
    displayName: text("display_name").notNull(),
    ownerAgentId: uuid("owner_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
    clientIdSecretId: uuid("client_id_secret_id").notNull().references(() => companySecrets.id, { onDelete: "restrict" }),
    clientSecretSecretId: uuid("client_secret_secret_id").notNull().references(() => companySecrets.id, { onDelete: "restrict" }),
    accessTokenSecretId: uuid("access_token_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    linkTokenSecretId: uuid("link_token_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    externalItemFingerprint: text("external_item_fingerprint"),
    connectionStatus: text("connection_status")
      .$type<CompanyFinanceConnectionStatus>()
      .notNull()
      .default("link_pending"),
    syncStatus: text("sync_status").$type<CompanyFinanceSyncStatus>().notNull().default("idle"),
    revocationStatus: text("revocation_status")
      .$type<CompanyFinanceRevocationStatus>()
      .notNull()
      .default("not_requested"),
    syncCoverage: text("sync_coverage").$type<CompanyFinanceSyncCoverage>().notNull().default("unavailable"),
    syncCursor: text("sync_cursor"),
    availableCashCents: bigint("available_cash_cents", { mode: "number" }),
    currentCashCents: bigint("current_cash_cents", { mode: "number" }),
    cashCurrency: text("cash_currency"),
    accountCount: integer("account_count").notNull().default(0),
    activeTransactionCount: integer("active_transaction_count").notNull().default(0),
    pendingTransactionCount: integer("pending_transaction_count").notNull().default(0),
    foreignCurrencyTransactionCount: integer("foreign_currency_transaction_count").notNull().default(0),
    currentMonthExpenseCents: bigint("current_month_expense_cents", { mode: "number" }).notNull().default(0),
    currentMonthExpenseTransactionCount: integer("current_month_expense_transaction_count").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    syncStartedAt: timestamp("sync_started_at", { withTimezone: true }),
    syncFailureCount: integer("sync_failure_count").notNull().default(0),
    lastSyncError: text("last_sync_error"),
    snapshotFingerprint: text("snapshot_fingerprint"),
    linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationStartedAt: timestamp("revocation_started_at", { withTimezone: true }),
    revocationConfirmedAt: timestamp("revocation_confirmed_at", { withTimezone: true }),
    nextRevocationAttemptAt: timestamp("next_revocation_attempt_at", { withTimezone: true }),
    revocationFailureCount: integer("revocation_failure_count").notNull().default(0),
    lastRevocationError: text("last_revocation_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_finance_connections_company_status_idx").on(table.companyId, table.connectionStatus),
    syncDueIdx: index("company_finance_connections_sync_due_idx")
      .on(table.syncStatus, table.nextSyncAt)
      .where(sql`${table.nextSyncAt} is not null and ${table.syncStatus} in ('idle', 'retrying')`),
    revocationDueIdx: index("company_finance_connections_revocation_due_idx")
      .on(table.revocationStatus, table.nextRevocationAttemptAt)
      .where(sql`${table.nextRevocationAttemptAt} is not null and ${table.revocationStatus} = 'retrying'`),
    companyItemUq: uniqueIndex("company_finance_connections_company_item_uq")
      .on(table.companyId, table.providerKey, table.externalItemFingerprint)
      .where(sql`${table.externalItemFingerprint} is not null`),
    providerCheck: check("company_finance_connections_provider_check", sql`${table.providerKey} = 'plaid'`),
    environmentCheck: check("company_finance_connections_environment_check", sql`${table.environment} in ('sandbox', 'production')`),
    statusCheck: check("company_finance_connections_status_check", sql`${table.connectionStatus} in ('link_pending', 'connected', 'error', 'revoked')`),
    syncStatusCheck: check("company_finance_connections_sync_status_check", sql`${table.syncStatus} in ('idle', 'processing', 'retrying', 'error', 'revoked')`),
    revocationStatusCheck: check("company_finance_connections_revocation_status_check", sql`${table.revocationStatus} in ('not_requested', 'processing', 'retrying', 'error', 'confirmed')`),
    syncCoverageCheck: check("company_finance_connections_sync_coverage_check", sql`${table.syncCoverage} in ('unavailable', 'complete', 'test_mode', 'foreign_currency', 'bounded')`),
    itemFingerprintCheck: check("company_finance_connections_item_fingerprint_check", sql`${table.externalItemFingerprint} is null or ${table.externalItemFingerprint} ~ '^[0-9a-f]{64}$'`),
    snapshotFingerprintCheck: check("company_finance_connections_snapshot_fingerprint_check", sql`${table.snapshotFingerprint} is null or ${table.snapshotFingerprint} ~ '^[0-9a-f]{64}$'`),
    nonNegativeMetricsCheck: check(
      "company_finance_connections_nonnegative_metrics_check",
      sql`${table.availableCashCents} is null or ${table.availableCashCents} >= 0`,
    ),
    nonNegativeCountsCheck: check(
      "company_finance_connections_nonnegative_counts_check",
      sql`${table.accountCount} >= 0 and ${table.activeTransactionCount} >= 0 and ${table.pendingTransactionCount} >= 0 and ${table.foreignCurrencyTransactionCount} >= 0 and ${table.currentMonthExpenseCents} >= 0 and ${table.currentMonthExpenseTransactionCount} >= 0 and ${table.syncFailureCount} >= 0 and ${table.revocationFailureCount} >= 0`,
    ),
  }),
);

export const companyFinanceTransactions = pgTable(
  "company_finance_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companyFinanceConnections.id, { onDelete: "cascade" }),
    externalTransactionFingerprint: text("external_transaction_fingerprint").notNull(),
    externalAccountFingerprint: text("external_account_fingerprint").notNull(),
    occurredOn: date("occurred_on").notNull(),
    direction: text("direction").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    displayName: text("display_name").notNull(),
    categoryPrimary: text("category_primary"),
    categoryDetailed: text("category_detailed"),
    pending: boolean("pending").notNull().default(false),
    expenseEligible: boolean("expense_eligible").notNull().default(false),
    status: text("status").notNull().default("active"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectionTransactionUq: uniqueIndex("company_finance_transactions_connection_transaction_uq")
      .on(table.connectionId, table.externalTransactionFingerprint),
    companyOccurredIdx: index("company_finance_transactions_company_occurred_idx").on(table.companyId, table.occurredOn),
    connectionOccurredIdx: index("company_finance_transactions_connection_occurred_idx").on(table.connectionId, table.occurredOn),
    transactionFingerprintCheck: check("company_finance_transactions_transaction_fingerprint_check", sql`${table.externalTransactionFingerprint} ~ '^[0-9a-f]{64}$'`),
    accountFingerprintCheck: check("company_finance_transactions_account_fingerprint_check", sql`${table.externalAccountFingerprint} ~ '^[0-9a-f]{64}$'`),
    directionCheck: check("company_finance_transactions_direction_check", sql`${table.direction} in ('debit', 'credit')`),
    statusCheck: check("company_finance_transactions_status_check", sql`${table.status} in ('active', 'removed')`),
    amountCheck: check("company_finance_transactions_amount_check", sql`${table.amountCents} > 0`),
  }),
);

export const companyFinanceReceipts = pgTable(
  "company_finance_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => companyFinanceConnections.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyFinanceReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("company_finance_receipts_company_occurred_idx").on(table.companyId, table.occurredAt),
    connectionOccurredIdx: index("company_finance_receipts_connection_occurred_idx").on(table.connectionId, table.occurredAt),
    typeCheck: check("company_finance_receipts_type_check", sql`${table.type} in ('link_started', 'connected', 'synced', 'sync_failed', 'revocation_started', 'revocation_failed', 'revoked')`),
  }),
);
