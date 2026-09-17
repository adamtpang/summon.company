import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type {
  CompanyMediaFormat,
  CompanyMediaKind,
  CompanyMediaPurpose,
  CompanyMediaScheduleCadence,
  CompanyMediaScheduleStatus,
  CompanyMediaVideoDurationSeconds,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";

export const companyMediaSchedules = pgTable(
  "company_media_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CompanyMediaKind>().notNull(),
    status: text("status").$type<CompanyMediaScheduleStatus>().notNull().default("paused"),
    cadence: text("cadence").$type<CompanyMediaScheduleCadence>().notNull().default("daily"),
    brief: text("brief").notNull(),
    purpose: text("purpose").$type<CompanyMediaPurpose>().notNull(),
    format: text("format").$type<CompanyMediaFormat>().notNull(),
    videoDurationSeconds: integer("video_duration_seconds").$type<CompanyMediaVideoDurationSeconds>(),
    ownerAgentId: uuid("owner_agent_id").notNull().references(() => agents.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    enabledByUserId: text("enabled_by_user_id"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processingRunId: uuid("processing_run_id"),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
    lastIssueId: uuid("last_issue_id").references(() => issues.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKindUq: uniqueIndex("company_media_schedules_company_kind_uq").on(table.companyId, table.kind),
    dueIdx: index("company_media_schedules_due_idx")
      .on(table.status, table.nextRunAt)
      .where(sql`${table.status} = 'active' and ${table.nextRunAt} is not null`),
    statusCheck: check("company_media_schedules_status_check", sql`${table.status} in ('paused', 'active')`),
    kindCheck: check("company_media_schedules_kind_check", sql`${table.kind} in ('image', 'video')`),
    cadenceCheck: check("company_media_schedules_cadence_check", sql`${table.cadence} in ('daily', 'weekdays', 'weekly')`),
    purposeCheck: check("company_media_schedules_purpose_check", sql`${table.purpose} in ('website', 'social', 'advertising', 'product', 'internal')`),
    formatCheck: check("company_media_schedules_format_check", sql`${table.format} in ('square', 'portrait', 'landscape')`),
    durationCheck: check("company_media_schedules_duration_check", sql`(${table.kind} = 'image' and ${table.videoDurationSeconds} is null) or (${table.kind} = 'video' and ${table.videoDurationSeconds} in (4, 8, 12, 15))`),
    failureCountCheck: check("company_media_schedules_failure_count_check", sql`${table.failureCount} >= 0`),
  }),
);
