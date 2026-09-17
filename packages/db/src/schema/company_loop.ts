import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type {
  CompanyNightshiftDurationHours,
  CompanyNightshiftScheduleStatus,
  CompanyNightshiftTaskLimit,
} from "@paperclipai/shared";
import { companies } from "./companies.js";

export const companyNightshiftSchedules = pgTable(
  "company_nightshift_schedules",
  {
    companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
    status: text("status").$type<CompanyNightshiftScheduleStatus>().notNull().default("paused"),
    startHourUtc: integer("start_hour_utc").notNull().default(0),
    durationHours: integer("duration_hours").$type<CompanyNightshiftDurationHours>().notNull().default(4),
    maxTasks: integer("max_tasks").$type<CompanyNightshiftTaskLimit>().notNull().default(3),
    spendLimitCents: integer("spend_limit_cents").notNull().default(500),
    enabledByUserId: text("enabled_by_user_id"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
    lastCycleId: uuid("last_cycle_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueIdx: index("company_nightshift_schedules_due_idx")
      .on(table.status, table.nextRunAt)
      .where(sql`${table.status} = 'active' and ${table.nextRunAt} is not null`),
    statusCheck: check("company_nightshift_schedules_status_check", sql`${table.status} in ('paused', 'active')`),
    startHourCheck: check("company_nightshift_schedules_start_hour_check", sql`${table.startHourUtc} between 0 and 23`),
    durationCheck: check("company_nightshift_schedules_duration_check", sql`${table.durationHours} in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 48, 72, 120)`),
    taskLimitCheck: check("company_nightshift_schedules_task_limit_check", sql`${table.maxTasks} between 1 and 5`),
    spendLimitCheck: check("company_nightshift_schedules_spend_limit_check", sql`${table.spendLimitCents} between 100 and 100000`),
    failureCountCheck: check("company_nightshift_schedules_failure_count_check", sql`${table.failureCount} >= 0`),
  }),
);
