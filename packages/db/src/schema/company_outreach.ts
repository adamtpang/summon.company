import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { CompanyOutreachAddressVerificationStatus, CompanyOutreachAutomationCadence, CompanyOutreachAutomationStatus, CompanyOutreachCampaignStatus, CompanyOutreachConnectionStatus, CompanyOutreachLeadStatus, CompanyOutreachMessageStatus, CompanyOutreachReceiptType, CompanyOutreachRecipientSnapshot, CompanyOutreachSuppressionReason, CompanyOutreachVerificationConnectionStatus, CompanyOutreachWebhookStatus } from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companyInboxConnectors } from "./company_inbox.js";
import { companySecrets } from "./company_secrets.js";
import { issues } from "./issues.js";

export const companyOutreachConnections = pgTable("company_outreach_connections", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  providerKey: text("provider_key").notNull(), externalServerId: text("external_server_id").notNull(), displayName: text("display_name").notNull(),
  fromName: text("from_name").notNull(), fromEmail: text("from_email").notNull(), replyToEmail: text("reply_to_email").notNull(), messageStream: text("message_stream").notNull(), optOutFooter: text("opt_out_footer").notNull(), unsubscribeBaseUrl: text("unsubscribe_base_url"),
  inboxConnectorId: uuid("inbox_connector_id").notNull().references(() => companyInboxConnectors.id, { onDelete: "restrict" }), ownerAgentId: uuid("owner_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
  credentialSecretId: uuid("credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }), status: text("status").$type<CompanyOutreachConnectionStatus>().notNull().default("connected"),
  grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]), dailySendLimit: integer("daily_send_limit").notNull().default(10), policyVersion: text("policy_version").notNull().default("permission-based-v1"),
  webhookAuthHash: text("webhook_auth_hash"), providerWebhookId: text("provider_webhook_id"), webhookStatus: text("webhook_status").$type<CompanyOutreachWebhookStatus>().notNull().default("unconfigured"),
  webhookVerifiedAt: timestamp("webhook_verified_at", { withTimezone: true }), webhookLastEventAt: timestamp("webhook_last_event_at", { withTimezone: true }), webhookLastError: text("webhook_last_error"),
  verificationProviderKey: text("verification_provider_key").notNull().default("hunter"), verificationCredentialSecretId: uuid("verification_credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
  verificationStatus: text("verification_status").$type<CompanyOutreachVerificationConnectionStatus>().notNull().default("unconfigured"), verificationRequestsRemaining: integer("verification_requests_remaining"),
  verificationLastSyncedAt: timestamp("verification_last_synced_at", { withTimezone: true }), verificationLastError: text("verification_last_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }), lastError: text("last_error"), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyStatusIdx: index("company_outreach_connections_company_status_idx").on(table.companyId, table.status), companyProviderServerUq: uniqueIndex("company_outreach_connections_provider_server_uq").on(table.companyId, table.providerKey, table.externalServerId),
  statusCheck: check("company_outreach_connections_status_check", sql`${table.status} in ('connected', 'error', 'revoked')`), webhookStatusCheck: check("company_outreach_connections_webhook_status_check", sql`${table.webhookStatus} in ('unconfigured', 'provisioning', 'verified', 'error', 'revoked')`),
  webhookAuthHashCheck: check("company_outreach_connections_webhook_auth_hash_check", sql`${table.webhookAuthHash} is null or (length(${table.webhookAuthHash}) = 64 and ${table.webhookAuthHash} ~ '^[0-9a-f]{64}$')`),
  verificationProviderCheck: check("company_outreach_connections_verification_provider_check", sql`${table.verificationProviderKey} = 'hunter'`), verificationStatusCheck: check("company_outreach_connections_verification_status_check", sql`${table.verificationStatus} in ('unconfigured', 'ready', 'exhausted', 'error', 'revoked')`),
  verificationRemainingCheck: check("company_outreach_connections_verification_remaining_check", sql`${table.verificationRequestsRemaining} is null or ${table.verificationRequestsRemaining} >= 0`),
  providerWebhookUq: uniqueIndex("company_outreach_connections_provider_webhook_uq").on(table.companyId, table.providerKey, table.providerWebhookId).where(sql`${table.providerWebhookId} is not null`), dailyLimitCheck: check("company_outreach_connections_daily_limit_check", sql`${table.dailySendLimit} between 1 and 20`),
}));

export const companyOutreachLeads = pgTable("company_outreach_leads", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), email: text("email").notNull(), name: text("name").notNull(), companyName: text("company_name").notNull(), title: text("title"),
  sourceLabel: text("source_label").notNull(), sourceUrl: text("source_url"), contactBasis: text("contact_basis").notNull(), basisEvidence: text("basis_evidence").notNull(), status: text("status").$type<CompanyOutreachLeadStatus>().notNull().default("verification_required"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(), addressVerificationStatus: text("address_verification_status").$type<CompanyOutreachAddressVerificationStatus>().notNull().default("unverified"),
  addressVerificationScore: integer("address_verification_score"), addressVerifiedAt: timestamp("address_verified_at", { withTimezone: true }), addressVerificationConnectionId: uuid("address_verification_connection_id").references(() => companyOutreachConnections.id, { onDelete: "set null" }), addressVerificationLastError: text("address_verification_last_error"),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }), repliedAt: timestamp("replied_at", { withTimezone: true }), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyEmailUq: uniqueIndex("company_outreach_leads_company_email_uq").on(table.companyId, table.email), companyStatusIdx: index("company_outreach_leads_company_status_idx").on(table.companyId, table.status),
  statusCheck: check("company_outreach_leads_status_check", sql`${table.status} in ('verification_required', 'verification_pending', 'eligible', 'suppressed', 'replied', 'bounced')`), basisCheck: check("company_outreach_leads_basis_check", sql`${table.contactBasis} in ('explicit_opt_in', 'existing_customer', 'direct_business_request')`),
  verificationStatusCheck: check("company_outreach_leads_verification_status_check", sql`${table.addressVerificationStatus} in ('unverified', 'pending', 'valid', 'accept_all', 'webmail', 'disposable', 'invalid', 'unknown', 'privacy_claimed', 'error')`), verificationScoreCheck: check("company_outreach_leads_verification_score_check", sql`${table.addressVerificationScore} is null or ${table.addressVerificationScore} between 0 and 100`),
}));

export const companyOutreachCampaigns = pgTable("company_outreach_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), connectionId: uuid("connection_id").notNull().references(() => companyOutreachConnections.id, { onDelete: "cascade" }),
  name: text("name").notNull(), objective: text("objective").notNull(), status: text("status").$type<CompanyOutreachCampaignStatus>().notNull().default("active"), dailySendLimit: integer("daily_send_limit").notNull().default(10), maxFollowUps: integer("max_follow_ups").notNull().default(1),
  automationStatus: text("automation_status").$type<CompanyOutreachAutomationStatus>().notNull().default("paused"), automationCadence: text("automation_cadence").$type<CompanyOutreachAutomationCadence>().notNull().default("daily"), automationInstructions: text("automation_instructions"),
  automationEnabledByUserId: text("automation_enabled_by_user_id"), automationNextRunAt: timestamp("automation_next_run_at", { withTimezone: true }), automationLastRunAt: timestamp("automation_last_run_at", { withTimezone: true }), automationLastSuccessAt: timestamp("automation_last_success_at", { withTimezone: true }),
  automationProcessingStartedAt: timestamp("automation_processing_started_at", { withTimezone: true }), automationProcessingRunId: uuid("automation_processing_run_id"), automationFailureCount: integer("automation_failure_count").notNull().default(0), automationLastError: text("automation_last_error"), automationLastIssueId: uuid("automation_last_issue_id").references(() => issues.id, { onDelete: "set null" }),
  createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }), createdByUserId: text("created_by_user_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyStatusIdx: index("company_outreach_campaigns_company_status_idx").on(table.companyId, table.status), connectionCreatedIdx: index("company_outreach_campaigns_connection_created_idx").on(table.connectionId, table.createdAt),
  automationDueIdx: index("company_outreach_campaigns_automation_due_idx").on(table.automationStatus, table.automationNextRunAt).where(sql`${table.automationStatus} = 'active' and ${table.automationNextRunAt} is not null`),
  statusCheck: check("company_outreach_campaigns_status_check", sql`${table.status} in ('draft', 'active', 'paused', 'completed')`), limitsCheck: check("company_outreach_campaigns_limits_check", sql`${table.dailySendLimit} between 1 and 20 and ${table.maxFollowUps} between 0 and 2`),
  automationStatusCheck: check("company_outreach_campaigns_automation_status_check", sql`${table.automationStatus} in ('paused', 'active')`), automationCadenceCheck: check("company_outreach_campaigns_automation_cadence_check", sql`${table.automationCadence} in ('daily', 'weekdays', 'weekly')`), automationFailureCountCheck: check("company_outreach_campaigns_automation_failure_count_check", sql`${table.automationFailureCount} >= 0`),
}));

export const companyOutreachMessages = pgTable("company_outreach_messages", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), connectionId: uuid("connection_id").notNull().references(() => companyOutreachConnections.id, { onDelete: "cascade" }), campaignId: uuid("campaign_id").notNull().references(() => companyOutreachCampaigns.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").notNull().references(() => companyOutreachLeads.id, { onDelete: "restrict" }), sequenceNumber: integer("sequence_number").notNull().default(0), subject: text("subject").notNull(), body: text("body").notNull(), status: text("status").$type<CompanyOutreachMessageStatus>().notNull(), recipientSnapshot: jsonb("recipient_snapshot").$type<CompanyOutreachRecipientSnapshot>().notNull(),
  approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }), providerMessageId: text("provider_message_id"), providerOperationId: text("provider_operation_id"), createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }), createdByUserId: text("created_by_user_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }), deliveredAt: timestamp("delivered_at", { withTimezone: true }), repliedAt: timestamp("replied_at", { withTimezone: true }), lastError: text("last_error"), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyStatusIdx: index("company_outreach_messages_company_status_idx").on(table.companyId, table.status), campaignCreatedIdx: index("company_outreach_messages_campaign_created_idx").on(table.campaignId, table.createdAt), campaignLeadSequenceUq: uniqueIndex("company_outreach_messages_campaign_lead_sequence_uq").on(table.campaignId, table.leadId, table.sequenceNumber),
  connectionApprovalUq: uniqueIndex("company_outreach_messages_connection_approval_uq").on(table.connectionId, table.approvalId).where(sql`${table.approvalId} is not null`), connectionProviderMessageUq: uniqueIndex("company_outreach_messages_connection_provider_message_uq").on(table.connectionId, table.providerMessageId).where(sql`${table.providerMessageId} is not null`),
  statusCheck: check("company_outreach_messages_status_check", sql`${table.status} in ('awaiting_approval', 'executing', 'submitted', 'delivered', 'bounced', 'replied', 'failed', 'cancelled')`), sequenceCheck: check("company_outreach_messages_sequence_check", sql`${table.sequenceNumber} between 0 and 2`),
}));

export const companyOutreachSuppressions = pgTable("company_outreach_suppressions", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), normalizedEmail: text("normalized_email").notNull(), reason: text("reason").$type<CompanyOutreachSuppressionReason>().notNull(), source: text("source").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(), createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }), createdByUserId: text("created_by_user_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyEmailUq: uniqueIndex("company_outreach_suppressions_company_email_uq").on(table.companyId, table.normalizedEmail), companyOccurredIdx: index("company_outreach_suppressions_company_occurred_idx").on(table.companyId, table.occurredAt), reasonCheck: check("company_outreach_suppressions_reason_check", sql`${table.reason} in ('opt_out', 'hard_bounce', 'complaint', 'manual', 'reply_received', 'invalid_address', 'disposable_address', 'verification_privacy_request')`),
}));

export const companyOutreachUnsubscribeTokens = pgTable("company_outreach_unsubscribe_tokens", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").notNull().references(() => companyOutreachConnections.id, { onDelete: "cascade" }), leadId: uuid("lead_id").notNull().references(() => companyOutreachLeads.id, { onDelete: "restrict" }),
  messageId: uuid("message_id").notNull().references(() => companyOutreachMessages.id, { onDelete: "cascade" }), tokenHash: text("token_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  messageUq: uniqueIndex("company_outreach_unsubscribe_tokens_message_uq").on(table.messageId), tokenHashUq: uniqueIndex("company_outreach_unsubscribe_tokens_token_hash_uq").on(table.tokenHash),
  companyCreatedIdx: index("company_outreach_unsubscribe_tokens_company_created_idx").on(table.companyId, table.createdAt), tokenHashCheck: check("company_outreach_unsubscribe_tokens_hash_check", sql`length(${table.tokenHash}) = 64 and ${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
}));

export const companyOutreachReceipts = pgTable("company_outreach_receipts", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), connectionId: uuid("connection_id").notNull().references(() => companyOutreachConnections.id, { onDelete: "cascade" }), campaignId: uuid("campaign_id").references(() => companyOutreachCampaigns.id, { onDelete: "cascade" }), leadId: uuid("lead_id").references(() => companyOutreachLeads.id, { onDelete: "set null" }), messageId: uuid("message_id").references(() => companyOutreachMessages.id, { onDelete: "cascade" }),
  type: text("type").$type<CompanyOutreachReceiptType>().notNull(), status: text("status").notNull(), summary: text("summary").notNull(), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}), approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }), providerOperationId: text("provider_operation_id"), providerEventId: text("provider_event_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(), createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }), createdByUserId: text("created_by_user_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyOccurredIdx: index("company_outreach_receipts_company_occurred_idx").on(table.companyId, table.occurredAt), connectionOccurredIdx: index("company_outreach_receipts_connection_occurred_idx").on(table.connectionId, table.occurredAt), connectionProviderEventUq: uniqueIndex("company_outreach_receipts_connection_provider_event_uq").on(table.connectionId, table.providerEventId).where(sql`${table.providerEventId} is not null`),
  typeCheck: check("company_outreach_receipts_type_check", sql`${table.type} in ('connected', 'campaign_created', 'lead_added', 'lead_verified', 'message_requested', 'message_submitted', 'message_delivered', 'message_bounced', 'reply_received', 'suppressed', 'revoked')`),
}));
