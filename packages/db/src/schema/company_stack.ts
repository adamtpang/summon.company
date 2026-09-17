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
  CompanyStackApplicationStatus,
  CompanyStackDatabaseSnapshotStatus,
  CompanyStackReceiptType,
  CompanyStackStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";
import { companyWebsites } from "./company_website.js";
import { projects } from "./projects.js";
import { projectWorkspaces } from "./project_workspaces.js";

export const companyStacks = pgTable(
  "company_stacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<CompanyStackStatus>()
      .notNull()
      .default("provisioning"),
    githubCredentialSecretId: uuid("github_credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    neonCredentialSecretId: uuid("neon_credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    vercelCredentialSecretId: uuid("vercel_credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    githubOwner: text("github_owner").notNull(),
    githubRepositoryName: text("github_repository_name").notNull(),
    githubRepositoryId: text("github_repository_id"),
    githubRepositoryFullName: text("github_repository_full_name"),
    githubRepositoryUrl: text("github_repository_url"),
    neonOrgId: text("neon_org_id"),
    neonRegionId: text("neon_region_id"),
    neonProjectId: text("neon_project_id"),
    neonBranchId: text("neon_branch_id"),
    neonDatabaseName: text("neon_database_name"),
    neonRoleName: text("neon_role_name"),
    neonDatabaseSecretId: uuid("neon_database_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    vercelTeamId: text("vercel_team_id"),
    vercelProjectName: text("vercel_project_name").notNull(),
    vercelProjectId: text("vercel_project_id"),
    vercelProjectUrl: text("vercel_project_url"),
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
    companyStatusIdx: index("company_stacks_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    companyNameUq: uniqueIndex("company_stacks_company_name_uq").on(
      table.companyId,
      table.name,
    ),
    companyGithubRepositoryUq: uniqueIndex(
      "company_stacks_company_github_repository_uq",
    ).on(table.companyId, table.githubOwner, table.githubRepositoryName),
    statusCheck: check(
      "company_stacks_status_check",
      sql`${table.status} in ('provisioning', 'ready_for_build', 'source_ready', 'partial', 'outcome_unknown', 'failed', 'revoked')`,
    ),
  }),
);

export const companyStackReceipts = pgTable(
  "company_stack_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stackId: uuid("stack_id")
      .notNull()
      .references(() => companyStacks.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyStackReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
    companyOccurredIdx: index("company_stack_receipts_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
    stackOccurredIdx: index("company_stack_receipts_stack_occurred_idx").on(
      table.stackId,
      table.occurredAt,
    ),
    typeCheck: check(
      "company_stack_receipts_type_check",
      sql`${table.type} in ('provisioning_started', 'github_repository_created', 'neon_project_created', 'database_secret_stored', 'vercel_project_created', 'database_variable_created', 'ready_for_build', 'application_planned', 'source_publish_started', 'source_published', 'application_workspace_connected', 'website_connected', 'source_publish_failed', 'database_snapshot_started', 'database_snapshot_ready', 'database_snapshot_failed', 'database_snapshot_expired', 'database_snapshot_deleted', 'provisioning_failed', 'recovery_started', 'github_repository_reconciled', 'neon_project_reconciled', 'vercel_project_reconciled', 'database_variable_reconciled', 'recovery_failed', 'revoked')`,
    ),
  }),
);

export const companyStackApplications = pgTable(
  "company_stack_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stackId: uuid("stack_id")
      .notNull()
      .references(() => companyStacks.id, { onDelete: "cascade" }),
    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    applicationName: text("application_name").notNull(),
    idea: text("idea").notNull(),
    targetCustomer: text("target_customer").notNull(),
    templateKey: text("template_key").notNull(),
    templateVersion: text("template_version").notNull(),
    status: text("status")
      .$type<CompanyStackApplicationStatus>()
      .notNull()
      .default("planned"),
    sourceBranch: text("source_branch"),
    sourceBaseCommitSha: text("source_base_commit_sha"),
    sourceCommitSha: text("source_commit_sha"),
    sourceTreeSha: text("source_tree_sha"),
    manifestHash: text("manifest_hash").notNull(),
    manifestFileCount: integer("manifest_file_count").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    projectWorkspaceId: uuid("project_workspace_id").references(
      () => projectWorkspaces.id,
      { onDelete: "set null" },
    ),
    websiteId: uuid("website_id").references(() => companyWebsites.id, {
      onDelete: "set null",
    }),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    plannedAt: timestamp("planned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    stackUq: uniqueIndex("company_stack_applications_stack_uq").on(
      table.stackId,
    ),
    companyStatusIdx: index(
      "company_stack_applications_company_status_idx",
    ).on(table.companyId, table.status),
    projectIdx: index("company_stack_applications_project_idx").on(
      table.projectId,
    ),
    statusCheck: check(
      "company_stack_applications_status_check",
      sql`${table.status} in ('planned', 'publishing', 'source_ready', 'outcome_unknown', 'failed')`,
    ),
    manifestCountCheck: check(
      "company_stack_applications_manifest_count_check",
      sql`${table.manifestFileCount} > 0 and ${table.manifestFileCount} <= 32`,
    ),
  }),
);

export const companyStackDatabaseSnapshots = pgTable(
  "company_stack_database_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stackId: uuid("stack_id")
      .notNull()
      .references(() => companyStacks.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<CompanyStackDatabaseSnapshotStatus>()
      .notNull()
      .default("exporting"),
    filename: text("filename").notNull(),
    storageProvider: text("storage_provider"),
    objectKey: text("object_key"),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size"),
    sha256: text("sha256"),
    pgDumpVersion: text("pg_dump_version"),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requestedByUserId: text("requested_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyStackCreatedIdx: index(
      "company_stack_database_snapshots_company_stack_created_idx",
    ).on(table.companyId, table.stackId, table.createdAt),
    companyExpiryIdx: index(
      "company_stack_database_snapshots_company_expiry_idx",
    ).on(table.companyId, table.status, table.expiresAt),
    oneExportingPerStackUq: uniqueIndex(
      "company_stack_database_snapshots_one_exporting_per_stack_uq",
    )
      .on(table.stackId)
      .where(sql`${table.status} = 'exporting'`),
    statusCheck: check(
      "company_stack_database_snapshots_status_check",
      sql`${table.status} in ('exporting', 'ready', 'failed', 'expired', 'deleted')`,
    ),
    byteSizeCheck: check(
      "company_stack_database_snapshots_byte_size_check",
      sql`${table.byteSize} is null or ${table.byteSize} >= 0`,
    ),
  }),
);
