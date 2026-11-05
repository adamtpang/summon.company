import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  companySubscriptions,
  outcomeCommissions,
  pricingPlans,
  subscriptionUsageRecords,
} from "@paperclipai/db";
import { badRequest, notFound, unprocessable } from "../errors.js";

/**
 * Billing layer service (VIT-5).
 *
 * @see doc/finance/BILLING-LAYER.md
 *
 * Owns per-company subscription pricing, bundled-usage + metered-overage
 * accrual with markup over COGS, the spend-cap hard-stop that auto-pauses a
 * company, and outcome metering (commissions proportional to a measured
 * outcome). Reuses the same `cancelWorkForScope` hook the budget guard uses, so
 * a cap hit stops in-flight work exactly the way a budget hard-stop does.
 *
 * Doctrine: bill from COGS, never below it; measure every cent; hard-stop on
 * accrued SPEND, not on an issued invoice.
 */

export type SubscriptionScope = {
  companyId: string;
  scopeType: "company";
  scopeId: string;
};

export type SubscriptionServiceHooks = {
  /** Same hook the budget guard uses to cancel in-flight work on a hard-stop. */
  cancelWorkForScope?: (scope: SubscriptionScope) => Promise<void>;
};

type PlanRow = typeof pricingPlans.$inferSelect;
type SubscriptionRow = typeof companySubscriptions.$inferSelect;

export interface PlanInput {
  key: string;
  name: string;
  description?: string | null;
  basePriceCents?: number;
  currency?: string;
  billingInterval?: string;
  bundledUsageCents?: number;
  overageMarkupBps?: number;
  outcomeMetric?: string | null;
  outcomeRateBps?: number;
  isActive?: boolean;
}

export interface SubscribeInput {
  planId: string;
  capCents?: number | null;
  hardStopEnabled?: boolean;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  anchorDay?: number | null;
}

export interface RecordUsageInput {
  cogsCents: number;
  quantity?: number;
  unit?: string;
  description?: string | null;
  agentId?: string | null;
  issueId?: string | null;
  heartbeatRunId?: string | null;
  costEventId?: string | null;
  occurredAt?: Date;
}

export interface RecordOutcomeInput {
  metric: string;
  basisCents: number;
  /** Overrides the plan's outcomeRateBps when provided (e.g. per-deal rate). */
  rateBps?: number;
  agentId?: string | null;
  issueId?: string | null;
  issueOutcomeId?: string | null;
  direction?: "credit" | "debit";
  occurredAt?: Date;
}

/**
 * Markup over COGS. Billed = cogs * (10000 + markupBps) / 10000, rounded to the
 * nearest cent. A non-negative markup can never bill below cost — the smallest
 * figure is respected but margin is never given away.
 */
export function applyMarkup(cogsCents: number, markupBps: number): number {
  if (!Number.isFinite(cogsCents) || cogsCents <= 0) return 0;
  const bps = Number.isFinite(markupBps) ? Math.max(0, markupBps) : 0;
  const billed = Math.round((cogsCents * (10000 + bps)) / 10000);
  // Guard against rounding a tiny markup back below cost.
  return Math.max(cogsCents, billed);
}

function defaultMonthWindow(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

export function subscriptionService(db: Db, hooks: SubscriptionServiceHooks = {}) {
  async function assertCompany(companyId: string) {
    const row = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Company not found");
  }

  async function getPlanRow(companyId: string, planId: string): Promise<PlanRow> {
    const plan = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, planId))
      .then((rows) => rows[0] ?? null);
    if (!plan) throw notFound("Pricing plan not found");
    if (plan.companyId !== companyId) throw unprocessable("Plan does not belong to company");
    return plan;
  }

  async function getActiveSubscriptionRow(companyId: string): Promise<SubscriptionRow | null> {
    return db
      .select()
      .from(companySubscriptions)
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          eq(companySubscriptions.status, "active"),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  async function requireActiveSubscription(companyId: string): Promise<SubscriptionRow> {
    const sub = await getActiveSubscriptionRow(companyId);
    if (!sub) throw unprocessable("Company has no active subscription");
    return sub;
  }

  /** Sum of billed usage + base fee accrued in the subscription's current period. */
  async function periodSpendCents(dbLike: Db, sub: SubscriptionRow): Promise<number> {
    const [row] = await dbLike
      .select({
        billed: sql<number>`coalesce(sum(${subscriptionUsageRecords.billedCents}), 0)::double precision`,
      })
      .from(subscriptionUsageRecords)
      .where(
        and(
          eq(subscriptionUsageRecords.subscriptionId, sub.id),
          gte(subscriptionUsageRecords.periodStart, sub.currentPeriodStart),
          lt(subscriptionUsageRecords.periodStart, sub.currentPeriodEnd),
        ),
      );
    const plan = await dbLike
      .select({ basePriceCents: pricingPlans.basePriceCents })
      .from(pricingPlans)
      .where(eq(pricingPlans.id, sub.planId))
      .then((rows) => rows[0] ?? null);
    const base = plan?.basePriceCents ?? 0;
    return Number(row?.billed ?? 0) + base;
  }

  /** COGS accrued in the current period (drives the bundled-allowance split). */
  async function periodCogsCents(dbLike: Db, sub: SubscriptionRow): Promise<number> {
    const [row] = await dbLike
      .select({
        cogs: sql<number>`coalesce(sum(${subscriptionUsageRecords.cogsCents}), 0)::double precision`,
      })
      .from(subscriptionUsageRecords)
      .where(
        and(
          eq(subscriptionUsageRecords.subscriptionId, sub.id),
          gte(subscriptionUsageRecords.periodStart, sub.currentPeriodStart),
          lt(subscriptionUsageRecords.periodStart, sub.currentPeriodEnd),
        ),
      );
    return Number(row?.cogs ?? 0);
  }

  /** DB-only half of the pause: writes the paused state atomically with the cap
   * decision that triggered it. The cancelWorkForScope hook runs separately,
   * after the transaction commits — it can do real IO and shouldn't hold the
   * row lock or roll back the pause if it fails. */
  async function pauseCompanyForCapTx(txDb: Db, sub: SubscriptionRow) {
    const now = new Date();
    // Pause the company using the enforced "budget" pause reason so the existing
    // resume path recognizes it; record the billing-specific reason on the sub.
    await txDb
      .update(companies)
      .set({ status: "paused", pauseReason: "budget", pausedAt: now, updatedAt: now })
      .where(and(eq(companies.id, sub.companyId), eq(companies.status, "active")));
    await txDb
      .update(companySubscriptions)
      .set({ pausedAt: now, pauseReason: "billing_cap", updatedAt: now })
      .where(eq(companySubscriptions.id, sub.id));
  }

  return {
    applyMarkup,

    createPlan: async (companyId: string, input: PlanInput, userId?: string | null): Promise<PlanRow> => {
      await assertCompany(companyId);
      if (!input.key?.trim()) throw badRequest("Plan key is required");
      const existing = await db
        .select({ id: pricingPlans.id })
        .from(pricingPlans)
        .where(and(eq(pricingPlans.companyId, companyId), eq(pricingPlans.key, input.key)))
        .then((rows) => rows[0] ?? null);
      if (existing) throw unprocessable(`Plan key '${input.key}' already exists`);

      return db
        .insert(pricingPlans)
        .values({
          companyId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          basePriceCents: input.basePriceCents ?? 0,
          currency: input.currency ?? "USD",
          billingInterval: input.billingInterval ?? "monthly",
          bundledUsageCents: input.bundledUsageCents ?? 0,
          overageMarkupBps: input.overageMarkupBps ?? 0,
          outcomeMetric: input.outcomeMetric ?? null,
          outcomeRateBps: input.outcomeRateBps ?? 0,
          isActive: input.isActive ?? true,
          createdByUserId: userId ?? null,
          updatedByUserId: userId ?? null,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    listPlans: async (companyId: string): Promise<PlanRow[]> => {
      await assertCompany(companyId);
      return db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.companyId, companyId))
        .orderBy(desc(pricingPlans.isActive), desc(pricingPlans.updatedAt));
    },

    subscribe: async (companyId: string, input: SubscribeInput, userId?: string | null): Promise<SubscriptionRow> => {
      await assertCompany(companyId);
      const plan = await getPlanRow(companyId, input.planId);
      if (!plan.isActive) throw unprocessable("Cannot subscribe to an inactive plan");

      const now = new Date();
      const { start, end } = defaultMonthWindow(now);
      const periodStart = input.currentPeriodStart ?? start;
      const periodEnd = input.currentPeriodEnd ?? end;
      if (periodEnd <= periodStart) throw badRequest("currentPeriodEnd must be after currentPeriodStart");

      const existing = await getActiveSubscriptionRow(companyId);
      if (existing) {
        // Switch plan / update cap on the single active subscription in place.
        return db
          .update(companySubscriptions)
          .set({
            planId: plan.id,
            capCents: input.capCents ?? existing.capCents ?? null,
            hardStopEnabled: input.hardStopEnabled ?? existing.hardStopEnabled,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            anchorDay: input.anchorDay ?? existing.anchorDay ?? null,
            updatedByUserId: userId ?? null,
            updatedAt: now,
          })
          .where(eq(companySubscriptions.id, existing.id))
          .returning()
          .then((rows) => rows[0]);
      }

      return db
        .insert(companySubscriptions)
        .values({
          companyId,
          planId: plan.id,
          status: "active",
          capCents: input.capCents ?? null,
          hardStopEnabled: input.hardStopEnabled ?? true,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          anchorDay: input.anchorDay ?? null,
          createdByUserId: userId ?? null,
          updatedByUserId: userId ?? null,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    getActiveSubscription: getActiveSubscriptionRow,

    /**
     * Meter one unit of COGS against the active subscription. Splits it into the
     * portion still covered by the plan's bundled allowance (billed 0) and the
     * overage portion (marked up over COGS). Then, if enabled, enforces the
     * spend cap: when accrued period spend reaches the cap, the company is
     * hard-stopped and in-flight work is cancelled.
     */
    recordUsage: async (companyId: string, input: RecordUsageInput) => {
      const sub = await requireActiveSubscription(companyId);
      const plan = await getPlanRow(companyId, sub.planId);
      const cogs = Math.max(0, Math.round(input.cogsCents));
      if (cogs === 0) throw badRequest("cogsCents must be greater than zero");
      const occurredAt = input.occurredAt ?? new Date();

      // The insert + cap-check + pause run inside one transaction, holding a
      // row lock on the subscription, so two concurrent recordUsage calls for
      // the same subscription can't both read spend under the cap before
      // either's insert lands - the second call always sees the first's
      // committed spend before deciding whether it tips the cap.
      const { record, capHit } = await db.transaction(async (tx) => {
        const txDb = tx as unknown as Db;
        const [lockedSub] = await txDb
          .select()
          .from(companySubscriptions)
          .where(eq(companySubscriptions.id, sub.id))
          .for("update");
        if (!lockedSub) throw unprocessable("Company has no active subscription");

        // How much of the bundled allowance is still unused this period.
        const priorCogs = await periodCogsCents(txDb, lockedSub);
        const bundleRemaining = Math.max(0, plan.bundledUsageCents - priorCogs);
        const bundledPortion = Math.min(cogs, bundleRemaining);
        const overageCogs = cogs - bundledPortion;
        const billed = applyMarkup(overageCogs, plan.overageMarkupBps);

        const record = await txDb
          .insert(subscriptionUsageRecords)
          .values({
            companyId,
            subscriptionId: lockedSub.id,
            agentId: input.agentId ?? null,
            issueId: input.issueId ?? null,
            heartbeatRunId: input.heartbeatRunId ?? null,
            costEventId: input.costEventId ?? null,
            description: input.description ?? null,
            periodStart: lockedSub.currentPeriodStart,
            unit: input.unit ?? "usd_cogs",
            quantity: input.quantity ?? 1,
            cogsCents: cogs,
            bundledCents: bundledPortion,
            overageCogsCents: overageCogs,
            markupBps: plan.overageMarkupBps,
            billedCents: billed,
            occurredAt,
          })
          .returning()
          .then((rows) => rows[0]);

        // Hard-stop on ACCRUED SPEND, not on an issued bill.
        let capHit = false;
        if (lockedSub.hardStopEnabled && lockedSub.capCents != null && lockedSub.capCents > 0) {
          const spend = await periodSpendCents(txDb, lockedSub);
          if (spend >= lockedSub.capCents) {
            capHit = true;
            await pauseCompanyForCapTx(txDb, lockedSub);
          }
        }

        return { record, capHit };
      });

      // The cancellation hook does real IO (cancelling live runs) - run it
      // after the transaction commits, not while the row lock is held.
      if (capHit) {
        await hooks.cancelWorkForScope?.({
          companyId: sub.companyId,
          scopeType: "company",
          scopeId: sub.companyId,
        });
      }

      return { record, capHit };
    },

    /**
     * Outcome metering — accrue a commission proportional to a measured outcome.
     * e.g. a sales agent earns `rateBps` of every `revenue_moved_cents`.
     */
    recordOutcomeCommission: async (companyId: string, input: RecordOutcomeInput) => {
      const sub = await getActiveSubscriptionRow(companyId);
      let rateBps = input.rateBps;
      if (rateBps == null && sub) {
        const plan = await getPlanRow(companyId, sub.planId);
        rateBps = plan.outcomeRateBps;
      }
      rateBps = Math.max(0, rateBps ?? 0);
      if (rateBps === 0) throw badRequest("No outcome commission rate is configured");
      const basis = Math.round(input.basisCents);
      const commission = Math.max(0, Math.round((basis * rateBps) / 10000));
      const occurredAt = input.occurredAt ?? new Date();

      return db
        .insert(outcomeCommissions)
        .values({
          companyId,
          subscriptionId: sub?.id ?? null,
          agentId: input.agentId ?? null,
          issueId: input.issueId ?? null,
          issueOutcomeId: input.issueOutcomeId ?? null,
          metric: input.metric,
          basisCents: basis,
          rateBps,
          commissionCents: commission,
          direction: input.direction ?? "credit",
          status: "accrued",
          periodStart: sub?.currentPeriodStart ?? null,
          occurredAt,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    /** Current-period invoice preview: base + overage + outcome commissions. */
    invoicePreview: async (companyId: string) => {
      const sub = await requireActiveSubscription(companyId);
      const plan = await getPlanRow(companyId, sub.planId);

      const [usage] = await db
        .select({
          cogsCents: sql<number>`coalesce(sum(${subscriptionUsageRecords.cogsCents}), 0)::double precision`,
          bundledCents: sql<number>`coalesce(sum(${subscriptionUsageRecords.bundledCents}), 0)::double precision`,
          overageCogsCents: sql<number>`coalesce(sum(${subscriptionUsageRecords.overageCogsCents}), 0)::double precision`,
          overageBilledCents: sql<number>`coalesce(sum(${subscriptionUsageRecords.billedCents}), 0)::double precision`,
          records: sql<number>`count(*)::int`,
        })
        .from(subscriptionUsageRecords)
        .where(
          and(
            eq(subscriptionUsageRecords.subscriptionId, sub.id),
            gte(subscriptionUsageRecords.periodStart, sub.currentPeriodStart),
            lt(subscriptionUsageRecords.periodStart, sub.currentPeriodEnd),
          ),
        );

      const [commissions] = await db
        .select({
          creditCents: sql<number>`coalesce(sum(case when ${outcomeCommissions.direction} = 'credit' then ${outcomeCommissions.commissionCents} else 0 end), 0)::double precision`,
          debitCents: sql<number>`coalesce(sum(case when ${outcomeCommissions.direction} = 'debit' then ${outcomeCommissions.commissionCents} else 0 end), 0)::double precision`,
          count: sql<number>`count(*)::int`,
        })
        .from(outcomeCommissions)
        .where(
          and(
            eq(outcomeCommissions.companyId, companyId),
            gte(outcomeCommissions.occurredAt, sub.currentPeriodStart),
            lt(outcomeCommissions.occurredAt, sub.currentPeriodEnd),
          ),
        );

      const baseCents = plan.basePriceCents;
      const overageBilledCents = Number(usage?.overageBilledCents ?? 0);
      const overageCogsCents = Number(usage?.overageCogsCents ?? 0);
      const subtotalCents = baseCents + overageBilledCents;
      const commissionsOwedCents = Number(commissions?.creditCents ?? 0) - Number(commissions?.debitCents ?? 0);

      return {
        companyId,
        subscriptionId: sub.id,
        planKey: plan.key,
        currency: plan.currency,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        baseCents,
        bundledUsageCents: plan.bundledUsageCents,
        usageCogsCents: Number(usage?.cogsCents ?? 0),
        bundledConsumedCents: Number(usage?.bundledCents ?? 0),
        overageCogsCents,
        overageBilledCents,
        // Margin captured on overage (billed above cost).
        overageMarginCents: overageBilledCents - overageCogsCents,
        subtotalCents,
        commissionsOwedCents,
        // What the company owes minus what we owe outcome-metered agents.
        netToPlatformCents: subtotalCents - commissionsOwedCents,
        capCents: sub.capCents,
        capRemainingCents:
          sub.capCents != null ? Math.max(0, sub.capCents - subtotalCents) : null,
        status: sub.status,
        pauseReason: sub.pauseReason,
        usageRecordCount: Number(usage?.records ?? 0),
        commissionCount: Number(commissions?.count ?? 0),
      };
    },
  };
}
