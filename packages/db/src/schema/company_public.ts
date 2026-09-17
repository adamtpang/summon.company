import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CompanyPublicDepartmentSnapshot,
  CompanyPublicEvidence,
  CompanyPublicReportCategory,
  CompanyPublicReportStatus,
  CompanyPublicProfileStatus,
  CompanyPublicSourceType,
  CompanyPublicUpdateCategory,
} from "@paperclipai/shared";
import { companies } from "./companies.js";

export const companyPublicProfiles = pgTable(
  "company_public_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    websiteUrl: text("website_url"),
    searchIndexing: boolean("search_indexing").notNull().default(false),
    discoveryEnabled: boolean("discovery_enabled").notNull().default(false),
    status: text("status").$type<CompanyPublicProfileStatus>().notNull().default("private"),
    departmentSnapshot: jsonb("department_snapshot")
      .$type<CompanyPublicDepartmentSnapshot[]>()
      .notNull()
      .default([]),
    rosterSnapshotAt: timestamp("roster_snapshot_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("company_public_profiles_company_uq").on(table.companyId),
    slugUq: uniqueIndex("company_public_profiles_slug_uq").on(table.slug),
    statusIdx: index("company_public_profiles_status_idx").on(table.status),
    statusCheck: check(
      "company_public_profiles_status_check",
      sql`${table.status} in ('private', 'public')`,
    ),
    slugCheck: check(
      "company_public_profiles_slug_check",
      sql`${table.slug} ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'`,
    ),
  }),
);

export const companyPublicUpdates = pgTable(
  "company_public_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => companyPublicProfiles.id, { onDelete: "cascade" }),
    category: text("category").$type<CompanyPublicUpdateCategory>().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    publicUrl: text("public_url"),
    sourceType: text("source_type").$type<CompanyPublicSourceType>().notNull(),
    sourceId: uuid("source_id").notNull(),
    evidence: jsonb("evidence").$type<CompanyPublicEvidence>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnByUserId: text("withdrawn_by_user_id"),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyPublishedIdx: index("company_public_updates_company_published_idx").on(
      table.companyId,
      table.publishedAt,
    ),
    profilePublishedIdx: index("company_public_updates_profile_published_idx").on(
      table.profileId,
      table.publishedAt,
    ),
    sourceUq: uniqueIndex("company_public_updates_source_uq").on(
      table.companyId,
      table.sourceType,
      table.sourceId,
    ),
    categoryCheck: check(
      "company_public_updates_category_check",
      sql`${table.category} in ('milestone', 'launch', 'outcome', 'social', 'infrastructure')`,
    ),
    sourceTypeCheck: check(
      "company_public_updates_source_type_check",
      sql`${table.sourceType} in ('issue_outcome', 'website_receipt', 'payment_receipt', 'social_receipt', 'stack_receipt')`,
    ),
  }),
);

export const companyPublicAbuseReports = pgTable(
  "company_public_abuse_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => companyPublicProfiles.id, { onDelete: "cascade" }),
    category: text("category").$type<CompanyPublicReportCategory>().notNull(),
    details: text("details").notNull(),
    status: text("status").$type<CompanyPublicReportStatus>().notNull().default("open"),
    resolution: text("resolution"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_public_abuse_reports_company_status_idx").on(
      table.companyId,
      table.status,
      table.createdAt,
    ),
    profileCreatedIdx: index("company_public_abuse_reports_profile_created_idx").on(
      table.profileId,
      table.createdAt,
    ),
    categoryCheck: check(
      "company_public_abuse_reports_category_check",
      sql`${table.category} in ('privacy', 'impersonation', 'fraud', 'harmful_content', 'other')`,
    ),
    statusCheck: check(
      "company_public_abuse_reports_status_check",
      sql`${table.status} in ('open', 'dismissed', 'actioned')`,
    ),
  }),
);
