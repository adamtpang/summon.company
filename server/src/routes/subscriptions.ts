import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { subscriptionService } from "../services/subscriptions.js";
import { heartbeatService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";

/**
 * Billing layer routes (VIT-5).
 *
 * @see doc/finance/BILLING-LAYER.md
 *
 * Plan authoring and subscription changes are board-gated (they set price and
 * the spend cap). Usage metering can be reported by an agent for its own work,
 * mirroring the cost-events endpoint. All reads/writes are company-scoped.
 */

const isoDate = z
  .string()
  .datetime()
  .transform((s) => new Date(s));

const createPlanSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  basePriceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  billingInterval: z.enum(["monthly", "annual"]).optional(),
  bundledUsageCents: z.number().int().min(0).optional(),
  overageMarkupBps: z.number().int().min(0).max(1_000_000).optional(),
  outcomeMetric: z.string().max(64).nullish(),
  outcomeRateBps: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

const subscribeSchema = z.object({
  planId: z.string().uuid(),
  capCents: z.number().int().min(0).nullish(),
  hardStopEnabled: z.boolean().optional(),
  currentPeriodStart: isoDate.optional(),
  currentPeriodEnd: isoDate.optional(),
  anchorDay: z.number().int().min(1).max(28).nullish(),
});

const recordUsageSchema = z.object({
  cogsCents: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(32).optional(),
  description: z.string().max(2000).nullish(),
  agentId: z.string().uuid().nullish(),
  issueId: z.string().uuid().nullish(),
  heartbeatRunId: z.string().uuid().nullish(),
  costEventId: z.string().uuid().nullish(),
  occurredAt: isoDate.optional(),
});

const recordOutcomeSchema = z.object({
  metric: z.string().min(1).max(64),
  basisCents: z.number().int(),
  rateBps: z.number().int().min(0).max(10000).optional(),
  agentId: z.string().uuid().nullish(),
  issueId: z.string().uuid().nullish(),
  issueOutcomeId: z.string().uuid().nullish(),
  direction: z.enum(["credit", "debit"]).optional(),
  occurredAt: isoDate.optional(),
});

export function subscriptionRoutes(
  db: Db,
  options: { pluginWorkerManager?: PluginWorkerManager } = {},
) {
  const router = Router();
  const heartbeat = heartbeatService(db, {
    pluginWorkerManager: options.pluginWorkerManager,
  });
  const subscriptions = subscriptionService(db, {
    // Same cancel hook the budget hard-stop uses, so a cap hit stops live work.
    cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
  });

  router.post(
    "/companies/:companyId/pricing-plans",
    validate(createPlanSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const plan = await subscriptions.createPlan(companyId, req.body, req.actor.userId ?? "board");
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "pricing_plan.created",
        entityType: "pricing_plan",
        entityId: plan.id,
        details: { key: plan.key, basePriceCents: plan.basePriceCents, overageMarkupBps: plan.overageMarkupBps },
      });
      res.status(201).json(plan);
    },
  );

  router.get("/companies/:companyId/pricing-plans", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const plans = await subscriptions.listPlans(companyId);
    res.json(plans);
  });

  router.post(
    "/companies/:companyId/subscription",
    validate(subscribeSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const sub = await subscriptions.subscribe(companyId, req.body, req.actor.userId ?? "board");
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "subscription.set",
        entityType: "company_subscription",
        entityId: sub.id,
        details: { planId: sub.planId, capCents: sub.capCents, hardStopEnabled: sub.hardStopEnabled },
      });
      res.status(201).json(sub);
    },
  );

  router.get("/companies/:companyId/subscription", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const sub = await subscriptions.getActiveSubscription(companyId);
    if (!sub) {
      res.status(404).json({ error: "Company has no active subscription" });
      return;
    }
    res.json(sub);
  });

  router.get("/companies/:companyId/subscription/invoice-preview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const preview = await subscriptions.invoicePreview(companyId);
    res.json(preview);
  });

  router.post(
    "/companies/:companyId/subscription/usage",
    validate(recordUsageSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      // An agent may only meter its own usage; the board may meter anyone's.
      if (req.actor.type === "agent" && req.body.agentId && req.actor.agentId !== req.body.agentId) {
        res.status(403).json({ error: "Agent can only report its own usage" });
        return;
      }
      const { record, capHit } = await subscriptions.recordUsage(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: capHit ? "subscription.usage_recorded_cap_hit" : "subscription.usage_recorded",
        entityType: "subscription_usage_record",
        entityId: record.id,
        details: { cogsCents: record.cogsCents, billedCents: record.billedCents, capHit },
      });
      res.status(201).json({ record, capHit });
    },
  );

  router.post(
    "/companies/:companyId/subscription/outcomes",
    validate(recordOutcomeSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const commission = await subscriptions.recordOutcomeCommission(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "subscription.outcome_commission_accrued",
        entityType: "outcome_commission",
        entityId: commission.id,
        details: {
          metric: commission.metric,
          basisCents: commission.basisCents,
          rateBps: commission.rateBps,
          commissionCents: commission.commissionCents,
        },
      });
      res.status(201).json(commission);
    },
  );

  return router;
}
