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
import { sql } from "drizzle-orm";
import type {
  CompanyWebsiteConnectionStatus,
  CompanyWebsiteDeployAuthority,
  CompanyWebsiteDeploymentStatus,
  CompanyWebsiteDomainStatus,
  CompanyWebsiteEnvironmentStatus,
  CompanyWebsiteEnvironmentTarget,
  CompanyWebsiteHealthStatus,
  CompanyWebsiteReceiptType,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyWebsites = pgTable(
  "company_websites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    externalProjectId: text("external_project_id").notNull(),
    displayName: text("display_name").notNull(),
    productionUrl: text("production_url").notNull(),
    customDomain: text("custom_domain"),
    ownerAgentId: uuid("owner_agent_id").references(() => agents.id, { onDelete: "set null" }),
    credentialSecretId: uuid("credential_secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    providerConfig: jsonb("provider_config").$type<Record<string, unknown>>().notNull().default({}),
    connectionStatus: text("connection_status").$type<CompanyWebsiteConnectionStatus>().notNull().default("connected"),
    deployAuthority: text("deploy_authority").$type<CompanyWebsiteDeployAuthority>().notNull().default("approval_required"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    deploymentStatus: text("deployment_status").$type<CompanyWebsiteDeploymentStatus>().notNull().default("idle"),
    lastDeploymentId: text("last_deployment_id"),
    lastDeploymentVersion: text("last_deployment_version"),
    lastDeploymentUrl: text("last_deployment_url"),
    deploymentStartedAt: timestamp("deployment_started_at", { withTimezone: true }),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    domainStatus: text("domain_status").$type<CompanyWebsiteDomainStatus>().notNull().default("not_configured"),
    healthStatus: text("health_status").$type<CompanyWebsiteHealthStatus>().notNull().default("unknown"),
    lastHttpStatus: integer("last_http_status"),
    lastResponseTimeMs: integer("last_response_time_ms"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_websites_company_status_idx").on(table.companyId, table.connectionStatus),
    companyProviderProjectUq: uniqueIndex("company_websites_provider_project_uq").on(
      table.companyId,
      table.providerKey,
      table.externalProjectId,
    ),
    connectionStatusCheck: check(
      "company_websites_connection_status_check",
      sql`${table.connectionStatus} in ('connected', 'error', 'revoked')`,
    ),
    deployAuthorityCheck: check(
      "company_websites_deploy_authority_check",
      sql`${table.deployAuthority} in ('observe_only', 'approval_required')`,
    ),
    deploymentStatusCheck: check(
      "company_websites_deployment_status_check",
      sql`${table.deploymentStatus} in ('idle', 'queued', 'building', 'ready', 'failed', 'cancelled')`,
    ),
    domainStatusCheck: check(
      "company_websites_domain_status_check",
      sql`${table.domainStatus} in ('not_configured', 'pending', 'verified', 'error')`,
    ),
    healthStatusCheck: check(
      "company_websites_health_status_check",
      sql`${table.healthStatus} in ('unknown', 'healthy', 'degraded', 'down')`,
    ),
  }),
);

export const companyWebsiteReceipts = pgTable(
  "company_website_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id").notNull().references(() => companyWebsites.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyWebsiteReceiptType>().notNull(),
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
    companyOccurredIdx: index("company_website_receipts_company_occurred_idx").on(table.companyId, table.occurredAt),
    websiteOccurredIdx: index("company_website_receipts_website_occurred_idx").on(table.websiteId, table.occurredAt),
    websiteApprovalExecutionUq: uniqueIndex("company_website_receipts_website_approval_execution_uq")
      .on(table.websiteId, table.approvalId)
      .where(sql`${table.type} = 'deployment_reported' and ${table.approvalId} is not null`),
    websiteRollbackRequestUq: uniqueIndex("company_website_receipts_website_rollback_request_uq")
      .on(table.websiteId, table.providerOperationId)
      .where(sql`${table.type} = 'rollback_reported' and ${table.providerOperationId} is not null`),
    websiteRedeployRequestUq: uniqueIndex("company_website_receipts_website_redeploy_request_uq")
      .on(table.websiteId, table.providerOperationId)
      .where(sql`${table.type} = 'redeployment_reported' and ${table.providerOperationId} is not null`),
    websitePromotionRequestUq: uniqueIndex("company_website_receipts_website_promotion_request_uq")
      .on(table.websiteId, table.providerOperationId)
      .where(sql`${table.type} = 'promotion_reported' and ${table.providerOperationId} is not null`),
    websiteProductionMutationExecutingUq: uniqueIndex("company_website_receipts_website_production_mutation_executing_uq")
      .on(table.websiteId)
      .where(sql`${table.type} in ('rollback_reported', 'redeployment_reported', 'promotion_reported') and ${table.status} = 'executing'`),
    typeCheck: check(
      "company_website_receipts_type_check",
      sql`${table.type} in ('connected', 'deployment_requested', 'deployment_reported', 'redeployment_reported', 'rollback_reported', 'promotion_reported', 'domain_reported', 'health_checked', 'environment_applied', 'revoked')`,
    ),
  }),
);

export const companyWebsiteEnvironmentVariables = pgTable(
  "company_website_environment_variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id").notNull().references(() => companyWebsites.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    secretId: uuid("secret_id").notNull().references(() => companySecrets.id, { onDelete: "set null" }),
    targets: jsonb("targets").$type<CompanyWebsiteEnvironmentTarget[]>().notNull().default([]),
    status: text("status").$type<CompanyWebsiteEnvironmentStatus>().notNull().default("pending"),
    providerEnvironmentId: text("provider_environment_id"),
    appliedSecretVersion: integer("applied_secret_version"),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    websiteKeyUq: uniqueIndex("company_website_environment_variables_website_key_uq").on(table.websiteId, table.key),
    websiteStatusIdx: index("company_website_environment_variables_website_status_idx").on(table.websiteId, table.status),
    companyIdx: index("company_website_environment_variables_company_idx").on(table.companyId),
    statusCheck: check(
      "company_website_environment_variables_status_check",
      sql`${table.status} in ('pending', 'applied', 'error')`,
    ),
  }),
);
