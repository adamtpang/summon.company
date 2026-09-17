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
  CompanyNotificationDeliveryStatus,
  CompanyNotificationEventKind,
  CompanyNotificationReceiptType,
  CompanyNotificationSeverity,
} from "@paperclipai/shared";
import { activityLog } from "./activity_log.js";
import { companies } from "./companies.js";
import { companyInboxConnectors } from "./company_inbox.js";

export const companyNotificationPreferences = pgTable(
  "company_notification_preferences",
  {
    companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
    enabledEventKinds: text("enabled_event_kinds").array().$type<CompanyNotificationEventKind[]>().notNull().default(sql`ARRAY['board_decision','customer_message','operational_alert','budget_stop','nightshift_complete','nightshift_failed','daily_brief','manual_task_result']::text[]`),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    enabledKindsCheck: check(
      "company_notification_preferences_enabled_kinds_check",
      sql`${table.enabledEventKinds} <@ ARRAY['board_decision','customer_message','operational_alert','budget_stop','nightshift_complete','nightshift_failed','daily_brief','manual_task_result']::text[]`,
    ),
  }),
);

export const companyNotificationDeliveries = pgTable(
  "company_notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => companyInboxConnectors.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").notNull().references(() => activityLog.id, { onDelete: "cascade" }),
    eventKind: text("event_kind").$type<CompanyNotificationEventKind>().notNull(),
    severity: text("severity").$type<CompanyNotificationSeverity>().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    targetPath: text("target_path"),
    status: text("status").$type<CompanyNotificationDeliveryStatus>().notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow(),
    providerOperationId: text("provider_operation_id"),
    lastError: text("last_error"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    connectorActivityUq: uniqueIndex("company_notification_deliveries_connector_activity_uq")
      .on(table.connectorId, table.activityId),
    companyDueIdx: index("company_notification_deliveries_company_due_idx")
      .on(table.companyId, table.status, table.nextAttemptAt),
    connectorCreatedIdx: index("company_notification_deliveries_connector_created_idx")
      .on(table.connectorId, table.createdAt),
    eventKindCheck: check("company_notification_deliveries_event_kind_check", sql`${table.eventKind} in ('board_decision', 'customer_message', 'operational_alert', 'budget_stop', 'nightshift_complete', 'nightshift_failed', 'daily_brief', 'manual_task_result')`),
    severityCheck: check("company_notification_deliveries_severity_check", sql`${table.severity} in ('low', 'medium', 'high', 'critical')`),
    statusCheck: check("company_notification_deliveries_status_check", sql`${table.status} in ('pending', 'delivering', 'delivered', 'failed', 'outcome_unknown', 'revoked')`),
    attemptCheck: check("company_notification_deliveries_attempt_check", sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= 5`),
  }),
);

export const companyNotificationReceipts = pgTable(
  "company_notification_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id").notNull().references(() => companyNotificationDeliveries.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").notNull().references(() => companyInboxConnectors.id, { onDelete: "cascade" }),
    type: text("type").$type<CompanyNotificationReceiptType>().notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    attempt: integer("attempt").notNull().default(0),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deliveryAttemptTypeUq: uniqueIndex("company_notification_receipts_delivery_attempt_type_uq")
      .on(table.deliveryId, table.attempt, table.type),
    companyOccurredIdx: index("company_notification_receipts_company_occurred_idx")
      .on(table.companyId, table.occurredAt),
    typeCheck: check("company_notification_receipts_type_check", sql`${table.type} in ('captured', 'delivery_reserved', 'delivered', 'delivery_failed', 'outcome_unknown', 'revoked')`),
    attemptCheck: check("company_notification_receipts_attempt_check", sql`${table.attempt} >= 0 and ${table.attempt} <= 5`),
  }),
);
