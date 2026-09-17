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
  CompanyMobileAppStatus,
  CompanyMobileBuildPlatform,
  CompanyMobileBuildProfile,
  CompanyMobileBuildStatus,
  CompanyMobileReceiptType,
  CompanyMobileReleasePlatform,
  CompanyMobileReleaseStatus,
  CompanyMobileReleaseTarget,
  CompanyMobileSourceStatus,
  CompanyMobileWorkflowJob,
  CompanyMobileWebhookStatus,
  SummonMobileApplicationTemplateVersion,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyMobileApps = pgTable(
  "company_mobile_apps",
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
      .$type<CompanyMobileAppStatus>()
      .notNull()
      .default("configured"),
    expoProjectId: uuid("expo_project_id").notNull(),
    repositoryFullName: text("repository_full_name").notNull(),
    workflowFileName: text("workflow_file_name").notNull(),
    credentialSecretId: uuid("credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    sourceRepositoryId: text("source_repository_id"),
    sourceCredentialSecretId: uuid("source_credential_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    webhookPublicId: uuid("webhook_public_id").notNull().defaultRandom(),
    webhookSigningSecretId: uuid("webhook_signing_secret_id").references(
      () => companySecrets.id,
      { onDelete: "set null" },
    ),
    webhookStatus: text("webhook_status")
      .$type<CompanyMobileWebhookStatus>()
      .notNull()
      .default("unconfigured"),
    webhookConfiguredAt: timestamp("webhook_configured_at", { withTimezone: true }),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
    lastWebhookError: text("last_webhook_error"),
    latestBuildStatus: text("latest_build_status").$type<CompanyMobileBuildStatus>(),
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
    companyStatusIdx: index("company_mobile_apps_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    oneActivePerCompanyUq: uniqueIndex(
      "company_mobile_apps_one_active_per_company_uq",
    )
      .on(table.companyId)
      .where(sql`${table.status} <> 'revoked'`),
    activeExpoProjectUq: uniqueIndex(
      "company_mobile_apps_active_expo_project_uq",
    )
      .on(table.companyId, table.expoProjectId)
      .where(sql`${table.status} <> 'revoked'`),
    webhookPublicIdUq: uniqueIndex(
      "company_mobile_apps_webhook_public_id_uq",
    ).on(table.webhookPublicId),
    statusCheck: check(
      "company_mobile_apps_status_check",
      sql`${table.status} in ('configured', 'active', 'attention', 'revoked')`,
    ),
    latestBuildStatusCheck: check(
      "company_mobile_apps_latest_build_status_check",
      sql`${table.latestBuildStatus} is null or ${table.latestBuildStatus} in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch')`,
    ),
    webhookStatusCheck: check(
      "company_mobile_apps_webhook_status_check",
      sql`${table.webhookStatus} in ('unconfigured', 'active', 'error', 'revoked')`,
    ),
  }),
);

export const companyMobileSources = pgTable(
  "company_mobile_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    mobileAppId: uuid("mobile_app_id")
      .notNull()
      .references(() => companyMobileApps.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<CompanyMobileSourceStatus>()
      .notNull()
      .default("planned"),
    idea: text("idea").notNull(),
    targetCustomer: text("target_customer").notNull(),
    primaryAction: text("primary_action").notNull(),
    androidPackage: text("android_package").notNull(),
    iosBundleIdentifier: text("ios_bundle_identifier").notNull(),
    iosAppStoreConnectAppId: text("ios_app_store_connect_app_id"),
    releaseWorkflowFileName: text("release_workflow_file_name"),
    templateKey: text("template_key").notNull(),
    templateVersion: text("template_version")
      .$type<SummonMobileApplicationTemplateVersion>()
      .notNull(),
    manifestHash: text("manifest_hash").notNull(),
    manifestFileCount: integer("manifest_file_count").notNull(),
    sourceBranch: text("source_branch"),
    sourceBaseCommitSha: text("source_base_commit_sha"),
    sourceCommitSha: text("source_commit_sha"),
    sourceTreeSha: text("source_tree_sha"),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requestedByAgentId: uuid("requested_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" },
    ),
    requestedByUserId: text("requested_by_user_id"),
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
    appUq: uniqueIndex("company_mobile_sources_app_uq").on(table.mobileAppId),
    appRequestUq: uniqueIndex("company_mobile_sources_app_request_uq").on(
      table.mobileAppId,
      table.requestId,
    ),
    companyStatusIdx: index("company_mobile_sources_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    statusCheck: check(
      "company_mobile_sources_status_check",
      sql`${table.status} in ('planned', 'publishing', 'source_ready', 'failed', 'outcome_unknown')`,
    ),
    manifestCountCheck: check(
      "company_mobile_sources_manifest_count_check",
      sql`${table.manifestFileCount} > 0 and ${table.manifestFileCount} <= 32`,
    ),
    manifestHashCheck: check(
      "company_mobile_sources_manifest_hash_check",
      sql`${table.manifestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    sourceBaseCommitCheck: check(
      "company_mobile_sources_base_commit_check",
      sql`${table.sourceBaseCommitSha} is null or ${table.sourceBaseCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
    sourceCommitCheck: check(
      "company_mobile_sources_commit_check",
      sql`${table.sourceCommitSha} is null or ${table.sourceCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
    sourceTreeCheck: check(
      "company_mobile_sources_tree_check",
      sql`${table.sourceTreeSha} is null or ${table.sourceTreeSha} ~ '^[0-9a-f]{40}$'`,
    ),
  }),
);

export const companyMobileBuilds = pgTable(
  "company_mobile_builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    mobileAppId: uuid("mobile_app_id")
      .notNull()
      .references(() => companyMobileApps.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull(),
    status: text("status")
      .$type<CompanyMobileBuildStatus>()
      .notNull()
      .default("dispatching"),
    platform: text("platform").$type<CompanyMobileBuildPlatform>().notNull(),
    profile: text("profile").$type<CompanyMobileBuildProfile>().notNull(),
    gitCommitSha: text("git_commit_sha").notNull(),
    providerWorkflowRunId: uuid("provider_workflow_run_id"),
    providerWorkflowRunUrl: text("provider_workflow_run_url"),
    providerGitCommitSha: text("provider_git_commit_sha"),
    jobs: jsonb("jobs")
      .$type<CompanyMobileWorkflowJob[]>()
      .notNull()
      .default([]),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requestedByAgentId: uuid("requested_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" },
    ),
    requestedByUserId: text("requested_by_user_id"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appCreatedIdx: index("company_mobile_builds_app_created_idx").on(
      table.mobileAppId,
      table.createdAt,
    ),
    companyStatusIdx: index("company_mobile_builds_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    appRequestUq: uniqueIndex("company_mobile_builds_app_request_uq").on(
      table.mobileAppId,
      table.requestId,
    ),
    providerRunUq: uniqueIndex("company_mobile_builds_provider_run_uq")
      .on(table.providerWorkflowRunId)
      .where(sql`${table.providerWorkflowRunId} is not null`),
    oneUnresolvedPerAppUq: uniqueIndex(
      "company_mobile_builds_one_unresolved_per_app_uq",
    )
      .on(table.mobileAppId)
      .where(
        sql`${table.status} in ('dispatching', 'new', 'in_progress', 'action_required', 'outcome_unknown')`,
      ),
    statusCheck: check(
      "company_mobile_builds_status_check",
      sql`${table.status} in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch')`,
    ),
    platformCheck: check(
      "company_mobile_builds_platform_check",
      sql`${table.platform} in ('android', 'ios', 'all')`,
    ),
    profileCheck: check(
      "company_mobile_builds_profile_check",
      sql`${table.profile} in ('development', 'preview', 'production')`,
    ),
    gitCommitCheck: check(
      "company_mobile_builds_git_commit_check",
      sql`${table.gitCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
    providerGitCommitCheck: check(
      "company_mobile_builds_provider_git_commit_check",
      sql`${table.providerGitCommitSha} is null or ${table.providerGitCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
  }),
);

export const companyMobileReleases = pgTable(
  "company_mobile_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    mobileAppId: uuid("mobile_app_id")
      .notNull()
      .references(() => companyMobileApps.id, { onDelete: "cascade" }),
    buildId: uuid("build_id")
      .notNull()
      .references(() => companyMobileBuilds.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").notNull(),
    status: text("status")
      .$type<CompanyMobileReleaseStatus>()
      .notNull()
      .default("dispatching"),
    platform: text("platform").$type<CompanyMobileReleasePlatform>().notNull(),
    target: text("target").$type<CompanyMobileReleaseTarget>().notNull(),
    gitCommitSha: text("git_commit_sha").notNull(),
    providerBuildId: uuid("provider_build_id").notNull(),
    workflowFileName: text("workflow_file_name").notNull(),
    providerWorkflowRunId: uuid("provider_workflow_run_id"),
    providerWorkflowRunUrl: text("provider_workflow_run_url"),
    providerGitCommitSha: text("provider_git_commit_sha"),
    jobs: jsonb("jobs")
      .$type<CompanyMobileWorkflowJob[]>()
      .notNull()
      .default([]),
    lastError: text("last_error"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requestedByAgentId: uuid("requested_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" },
    ),
    requestedByUserId: text("requested_by_user_id"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appCreatedIdx: index("company_mobile_releases_app_created_idx").on(
      table.mobileAppId,
      table.createdAt,
    ),
    companyStatusIdx: index("company_mobile_releases_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    appRequestUq: uniqueIndex("company_mobile_releases_app_request_uq").on(
      table.mobileAppId,
      table.requestId,
    ),
    buildPlatformUq: uniqueIndex("company_mobile_releases_build_platform_uq").on(
      table.buildId,
      table.platform,
    ),
    providerRunUq: uniqueIndex("company_mobile_releases_provider_run_uq")
      .on(table.providerWorkflowRunId)
      .where(sql`${table.providerWorkflowRunId} is not null`),
    oneUnresolvedPerAppUq: uniqueIndex(
      "company_mobile_releases_one_unresolved_per_app_uq",
    )
      .on(table.mobileAppId)
      .where(
        sql`${table.status} in ('dispatching', 'new', 'in_progress', 'action_required', 'outcome_unknown')`,
      ),
    statusCheck: check(
      "company_mobile_releases_status_check",
      sql`${table.status} in ('dispatching', 'new', 'in_progress', 'action_required', 'succeeded', 'failed', 'canceled', 'outcome_unknown', 'revision_mismatch')`,
    ),
    platformCheck: check(
      "company_mobile_releases_platform_check",
      sql`${table.platform} in ('android', 'ios')`,
    ),
    targetCheck: check(
      "company_mobile_releases_target_check",
      sql`${table.target} in ('google_play_internal_draft', 'app_store_connect')`,
    ),
    platformTargetCheck: check(
      "company_mobile_releases_platform_target_check",
      sql`(${table.platform} = 'android' and ${table.target} = 'google_play_internal_draft') or (${table.platform} = 'ios' and ${table.target} = 'app_store_connect')`,
    ),
    gitCommitCheck: check(
      "company_mobile_releases_git_commit_check",
      sql`${table.gitCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
    providerGitCommitCheck: check(
      "company_mobile_releases_provider_git_commit_check",
      sql`${table.providerGitCommitSha} is null or ${table.providerGitCommitSha} ~ '^[0-9a-f]{40}$'`,
    ),
  }),
);

export const companyMobileReceipts = pgTable(
  "company_mobile_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    mobileAppId: uuid("mobile_app_id")
      .notNull()
      .references(() => companyMobileApps.id, { onDelete: "cascade" }),
    buildId: uuid("build_id").references(() => companyMobileBuilds.id, {
      onDelete: "set null",
    }),
    sourceId: uuid("source_id").references(() => companyMobileSources.id, {
      onDelete: "set null",
    }),
    releaseId: uuid("release_id").references(() => companyMobileReleases.id, {
      onDelete: "set null",
    }),
    type: text("type").$type<CompanyMobileReceiptType>().notNull(),
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
    appOccurredIdx: index("company_mobile_receipts_app_occurred_idx").on(
      table.mobileAppId,
      table.occurredAt,
    ),
    companyOccurredIdx: index(
      "company_mobile_receipts_company_occurred_idx",
    ).on(table.companyId, table.occurredAt),
    artifactProviderOperationUq: uniqueIndex(
      "company_mobile_receipts_artifact_provider_operation_uq",
    )
      .on(table.mobileAppId, table.providerOperationId)
      .where(
        sql`${table.type} = 'build_evidence_received' and ${table.providerOperationId} is not null`,
      ),
    typeCheck: check(
      "company_mobile_receipts_type_check",
      sql`${table.type} in ('configured', 'source_planned', 'source_publish_started', 'source_published', 'source_publish_failed', 'build_dispatch_started', 'build_dispatched', 'build_refreshed', 'build_succeeded', 'build_failed', 'build_outcome_unknown', 'build_reconciled', 'webhook_configured', 'build_evidence_received', 'release_dispatch_started', 'release_dispatched', 'release_refreshed', 'release_succeeded', 'release_failed', 'release_outcome_unknown', 'release_reconciled', 'revoked')`,
    ),
  }),
);
