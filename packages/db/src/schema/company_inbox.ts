import {
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
import { sql } from "drizzle-orm";
import type {
  CompanyInboxChannelType,
  CompanyInboxAutomationIntervalMinutes,
  CompanyInboxAutomationStatus,
  CompanyInboxConnectorStatus,
  CompanyInboxMessageDirection,
  CompanyInboxMessageStatus,
  CompanyInboxReplyAuthority,
  CompanyInboxReceiptType,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";
import { issues } from "./issues.js";

export const companyInboxConnectors = pgTable(
  "company_inbox_connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name").notNull(),
    channelType: text("channel_type").$type<CompanyInboxChannelType>().notNull(),
    accountLabel: text("account_label"),
    ownerAgentId: uuid("owner_agent_id").references(() => agents.id, { onDelete: "set null" }),
    credentialSecretId: uuid("credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    status: text("status").$type<CompanyInboxConnectorStatus>().notNull().default("connected"),
    replyAuthority: text("reply_authority").$type<CompanyInboxReplyAuthority>().notNull().default("draft_only"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    automationStatus: text("automation_status").$type<CompanyInboxAutomationStatus>().notNull().default("paused"),
    automationIntervalMinutes: integer("automation_interval_minutes").$type<CompanyInboxAutomationIntervalMinutes>().notNull().default(60),
    automationPrompt: text("automation_prompt"),
    automationCreateWork: boolean("automation_create_work").notNull().default(true),
    automationEnabledByUserId: text("automation_enabled_by_user_id"),
    automationNextRunAt: timestamp("automation_next_run_at", { withTimezone: true }),
    automationLastRunAt: timestamp("automation_last_run_at", { withTimezone: true }),
    automationLastSuccessAt: timestamp("automation_last_success_at", { withTimezone: true }),
    automationProcessingStartedAt: timestamp("automation_processing_started_at", { withTimezone: true }),
    automationFailureCount: integer("automation_failure_count").notNull().default(0),
    automationLastError: text("automation_last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_inbox_connectors_company_status_idx").on(table.companyId, table.status),
    automationDueIdx: index("company_inbox_connectors_automation_due_idx")
      .on(table.automationStatus, table.automationNextRunAt)
      .where(sql`${table.automationStatus} = 'active' and ${table.automationNextRunAt} is not null`),
    companyProviderAccountUq: uniqueIndex("company_inbox_connectors_provider_account_uq").on(
      table.companyId,
      table.providerKey,
      table.externalAccountId,
    ),
    channelTypeCheck: check(
      "company_inbox_connectors_channel_type_check",
      sql`${table.channelType} in ('email', 'chat', 'social', 'support', 'custom')`,
    ),
    statusCheck: check(
      "company_inbox_connectors_status_check",
      sql`${table.status} in ('connected', 'error', 'revoked')`,
    ),
    replyAuthorityCheck: check(
      "company_inbox_connectors_reply_authority_check",
      sql`${table.replyAuthority} in ('none', 'draft_only', 'approval_required')`,
    ),
    automationStatusCheck: check(
      "company_inbox_connectors_automation_status_check",
      sql`${table.automationStatus} in ('paused', 'active')`,
    ),
    automationIntervalCheck: check(
      "company_inbox_connectors_automation_interval_check",
      sql`${table.automationIntervalMinutes} in (5, 15, 30, 60, 180, 360, 720, 1440)`,
    ),
    automationFailureCountCheck: check(
      "company_inbox_connectors_automation_failure_count_check",
      sql`${table.automationFailureCount} >= 0`,
    ),
  }),
);

export const companyInboxMessages = pgTable(
  "company_inbox_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => companyInboxConnectors.id, { onDelete: "cascade" }),
    externalThreadId: text("external_thread_id").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    direction: text("direction").$type<CompanyInboxMessageDirection>().notNull(),
    status: text("status").$type<CompanyInboxMessageStatus>().notNull(),
    senderName: text("sender_name"),
    senderAddress: text("sender_address"),
    recipientName: text("recipient_name"),
    recipientAddress: text("recipient_address"),
    subject: text("subject"),
    body: text("body").notNull(),
    inReplyToExternalMessageId: text("in_reply_to_external_message_id"),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    providerOperationId: text("provider_operation_id"),
    workIssueId: uuid("work_issue_id").references(() => issues.id, { onDelete: "set null" }),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("company_inbox_messages_company_occurred_idx").on(table.companyId, table.occurredAt),
    companyStatusIdx: index("company_inbox_messages_company_status_idx").on(table.companyId, table.status),
    connectorThreadIdx: index("company_inbox_messages_connector_thread_idx").on(table.connectorId, table.externalThreadId),
    connectorExternalMessageUq: uniqueIndex("company_inbox_messages_connector_external_message_uq").on(
      table.connectorId,
      table.externalMessageId,
    ),
    connectorApprovalUq: uniqueIndex("company_inbox_messages_connector_approval_uq")
      .on(table.connectorId, table.approvalId)
      .where(sql`${table.approvalId} is not null`),
    connectorProviderOperationUq: uniqueIndex("company_inbox_messages_connector_provider_operation_uq")
      .on(table.connectorId, table.providerOperationId)
      .where(sql`${table.providerOperationId} is not null`),
    workIssueUq: uniqueIndex("company_inbox_messages_work_issue_uq")
      .on(table.workIssueId)
      .where(sql`${table.workIssueId} is not null`),
    directionCheck: check(
      "company_inbox_messages_direction_check",
      sql`${table.direction} in ('inbound', 'outbound')`,
    ),
    statusCheck: check(
      "company_inbox_messages_status_check",
      sql`${table.status} in ('unread', 'read', 'draft', 'pending_approval', 'executing', 'sent', 'failed', 'outcome_unknown', 'archived')`,
    ),
  }),
);

export const companyInboxReceipts = pgTable(
  "company_inbox_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => companyInboxConnectors.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => companyInboxMessages.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyInboxReceiptType>().notNull(),
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
    companyOccurredIdx: index("company_inbox_receipts_company_occurred_idx").on(table.companyId, table.occurredAt),
    connectorOccurredIdx: index("company_inbox_receipts_connector_occurred_idx").on(table.connectorId, table.occurredAt),
    typeCheck: check(
      "company_inbox_receipts_type_check",
      sql`${table.type} in ('connected', 'synced', 'message_received', 'work_created', 'reply_drafted', 'reply_requested', 'reply_reserved', 'reply_submitted', 'reply_reconciled', 'reply_failed', 'revoked')`,
    ),
    messageWorkCreatedUq: uniqueIndex("company_inbox_receipts_message_work_created_uq")
      .on(table.messageId, table.type)
      .where(sql`${table.messageId} is not null and ${table.type} = 'work_created'`),
  }),
);
