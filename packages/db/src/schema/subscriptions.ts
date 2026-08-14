import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { costEvents } from "./cost_events.js";
import { issueOutcomes } from "./issue_outcomes.js";

/**
 * Billing layer — subscriptions, metered usage, and outcome commissions.
 *
 * @see doc/finance/BILLING-LAYER.md (Vitals CFO, VIT-5).
 *
 * Doctrine (Rockefeller): measure every cent, know exactly where you gained or
 * lost, and never bill below what the unit actually cost. Every billed figure
 * on {@link subscriptionUsageRecords} is derived from a real
 * {@link costEvents} row (the COGS) and marked up by a snapshotted basis-point
 * rate, so the ledger always reconciles billed − COGS = margin.
 *
 * The four tables model, in order:
 *   1. pricing_plans           — per-company plan catalog (base + bundle + markup + outcome rate)
 *   2. company_subscriptions   — a company's live subscription, incl. the spend CAP that hard-stops work
 *   3. subscription_usage_records — metered usage split into bundled (free) vs marked-up overage
 *   4. outcome_commissions     — outcome metering: a payout proportional to a measured outcome
 *
 * These tables are additive to the existing cost/finance/budget domain and do
 * not replace {@link costEvents} (raw COGS), {@link financeEvents} (ledger), or
 * budget_policies (the generic spend guard). They add the *seller* side:
 * what a company is charged and what an outcome-metered agent has earned.
 */

/**
 * Per-company plan catalog. Pricing is per-company by construction — every plan
 * is scoped to a `companyId`, so each company defines its own base fee, bundled
 * allowance, overage markup, and outcome commission rate.
 */
export const pricingPlans = pgTable(
  "pricing_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // Stable slug, unique per company (e.g. "starter", "scale", "sdr-outcome").
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // The recurring per-company subscription fee.
    basePriceCents: integer("base_price_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    // monthly | annual
    billingInterval: text("billing_interval").notNull().default("monthly"),
    // Bundled-usage allowance INCLUDED in the base fee, measured in COGS cents.
    // Usage up to this amount per period is not separately billed.
    bundledUsageCents: integer("bundled_usage_cents").notNull().default(0),
    // Markup over COGS applied to metered OVERAGE, in basis points.
    // 2000 = +20%: billed = cogs * 1.20. 0 = pass-through at cost.
    overageMarkupBps: integer("overage_markup_bps").notNull().default(0),
    // Outcome metering: the measured lever an agent is paid in proportion to
    // (e.g. "revenue_moved_cents"). NULL = plan has no outcome component.
    outcomeMetric: text("outcome_metric"),
    // Commission rate on the outcome metric, in basis points.
    // 500 = 5% of the outcome amount.
    outcomeRateBps: integer("outcome_rate_bps").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyActiveIdx: index("pricing_plans_company_active_idx").on(
      table.companyId,
      table.isActive,
    ),
    companyKeyUniqueIdx: uniqueIndex("pricing_plans_company_key_unique_idx").on(
      table.companyId,
      table.key,
    ),
  }),
);

/**
 * A company's live subscription to one of its plans.
 *
 * `capCents` is the hard-stop budget cap. Enforcement is on ACCRUED SPEND, not
 * on an issued invoice — the moment period spend (billed usage + base) reaches
 * the cap, the subscription service pauses the company scope (mirroring the
 * budget_policies hard-stop). "The spend hits the cap, not the bill."
 */
export const companySubscriptions = pgTable(
  "company_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    planId: uuid("plan_id").notNull().references(() => pricingPlans.id),
    // active | paused | canceled
    status: text("status").notNull().default("active"),
    // Hard-stop spend cap for the current period, in billed cents.
    // NULL = uncapped (the base plan still bills, but no auto-pause).
    capCents: integer("cap_cents"),
    hardStopEnabled: boolean("hard_stop_enabled").notNull().default(true),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    // Day-of-month the period anchors to (1–28). NULL = anchored to start date.
    anchorDay: integer("anchor_day"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    // e.g. "billing_cap" when the spend cap hard-stopped the scope.
    pauseReason: text("pause_reason"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_subscriptions_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    planIdx: index("company_subscriptions_plan_idx").on(table.planId),
    // One active subscription row per company. Canceled rows are retained for
    // history; the partial-unique intent is enforced in the service layer.
    companyActiveUniqueIdx: uniqueIndex("company_subscriptions_company_active_unique_idx").on(
      table.companyId,
    ),
  }),
);

/**
 * Metered usage, split at record time into the bundled (base-covered, billed 0)
 * portion and the marked-up overage portion. Each row traces back to a
 * {@link costEvents} row for its COGS, so billed − COGS is auditable per line.
 */
export const subscriptionUsageRecords = pgTable(
  "subscription_usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => companySubscriptions.id),
    agentId: uuid("agent_id").references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    // Provenance to the raw COGS event this usage was metered from.
    costEventId: uuid("cost_event_id").references(() => costEvents.id),
    description: text("description"),
    // The billing period this usage counts against (matches the subscription's
    // current_period_start at record time), so period rollups are an index scan.
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    unit: text("unit").notNull().default("usd_cogs"),
    quantity: integer("quantity").notNull().default(1),
    // Raw cost of goods sold for this usage.
    cogsCents: integer("cogs_cents").notNull(),
    // Portion absorbed by the plan's bundled allowance (billed 0).
    bundledCents: integer("bundled_cents").notNull().default(0),
    // COGS portion beyond the bundle, before markup.
    overageCogsCents: integer("overage_cogs_cents").notNull().default(0),
    // Snapshot of the markup rate applied (bps), for audit even if the plan changes.
    markupBps: integer("markup_bps").notNull().default(0),
    // Marked-up amount actually billed for the overage portion.
    billedCents: integer("billed_cents").notNull().default(0),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyPeriodIdx: index("subscription_usage_records_company_period_idx").on(
      table.companyId,
      table.periodStart,
    ),
    subscriptionPeriodIdx: index("subscription_usage_records_subscription_period_idx").on(
      table.subscriptionId,
      table.periodStart,
    ),
    companyOccurredIdx: index("subscription_usage_records_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
    costEventIdx: index("subscription_usage_records_cost_event_idx").on(table.costEventId),
  }),
);

/**
 * Outcome metering — a payout accrued to an agent (or partner) in proportion to
 * a MEASURED outcome. e.g. a sales agent earns `outcomeRateBps` of every
 * `revenue_moved_cents` recorded on an {@link issueOutcomes} receipt.
 *
 * Direction is `credit` (owed out) by default; this is money the platform pays,
 * distinct from the debit-side usage billing above.
 */
export const outcomeCommissions = pgTable(
  "outcome_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    subscriptionId: uuid("subscription_id").references(() => companySubscriptions.id),
    // The agent paid in proportion to the outcome (e.g. the sales agent).
    agentId: uuid("agent_id").references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    // Provenance to the outcome receipt that measured the lever.
    issueOutcomeId: uuid("issue_outcome_id").references(() => issueOutcomes.id),
    // The measured lever driving the commission, e.g. "revenue_moved_cents".
    metric: text("metric").notNull(),
    // The measured outcome amount the rate is applied to.
    basisCents: integer("basis_cents").notNull(),
    // Commission rate in basis points (500 = 5%).
    rateBps: integer("rate_bps").notNull(),
    // basis_cents * rate_bps / 10000, rounded to the nearest cent.
    commissionCents: integer("commission_cents").notNull(),
    // credit = owed to the agent/partner (the common case); debit = clawback.
    direction: text("direction").notNull().default("credit"),
    // accrued | paid | reversed
    status: text("status").notNull().default("accrued"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("outcome_commissions_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
    companyStatusIdx: index("outcome_commissions_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    agentIdx: index("outcome_commissions_agent_idx").on(table.agentId),
    issueOutcomeIdx: index("outcome_commissions_issue_outcome_idx").on(table.issueOutcomeId),
  }),
);
