import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { policyLedgerService } from "../services/policy-ledger.js";
import { heartbeatService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";

/**
 * Per-employee policy / credential / cost-ledger routes (VIT-46).
 *
 * @see doc/finance/POLICY-LEDGER.md
 *
 * Manifests, policies, and credentials are board-gated (they set who may spend
 * what). Authorize/settle are the gateway hot path used by the runtime for the
 * employee's own work. Spend/ledger reads are company-scoped.
 */

const routeSchema = z.object({
  model: z.string().min(1).max(128),
  reserveUnits: z.number().int().positive(),
});

const upsertManifestSchema = z.object({
  key: z.string().min(1).max(64),
  displayName: z.string().min(1).max(200),
  billingModel: z.enum(["subscription", "api"]).optional(),
  unit: z.enum(["normalized_units", "microdollars"]).optional(),
  routes: z.array(routeSchema).max(200),
  capabilities: z.array(z.string().max(64)).max(64).optional(),
  isActive: z.boolean().optional(),
});

const grantSchema = z.object({
  adapterKey: z.string().min(1).max(64),
  models: z.union([z.literal("*"), z.array(z.string().max(128)).max(200)]),
});

const setPolicySchema = z.object({
  name: z.string().min(1).max(200),
  allowedAdapters: z.array(grantSchema).max(64),
  monthlyBudgetUnits: z.number().int().min(0).nullish(),
  unit: z.enum(["normalized_units", "microdollars"]).optional(),
  capabilityScopes: z.array(z.string().max(64)).max(64).optional(),
});

const authorizeSchema = z.object({
  adapterKey: z.string().min(1).max(64),
  model: z.string().min(1).max(128),
  capability: z.string().max(64).optional(),
  presentedGeneration: z.number().int(),
  estimatedUnits: z.number().int().positive().optional(),
  runId: z.string().max(200).nullish(),
  runCostLimitUnits: z.number().int().min(0).nullish(),
  issueId: z.string().uuid().nullish(),
  heartbeatRunId: z.string().uuid().nullish(),
});

const settleSchema = z.object({
  reservationId: z.string().uuid(),
  actualUnits: z.number().int().min(0),
  costEventId: z.string().uuid().nullish(),
  description: z.string().max(2000).nullish(),
});

const revokeSchema = z.object({ reason: z.string().max(200).nullish() });

export function policyLedgerRoutes(
  db: Db,
  options: { pluginWorkerManager?: PluginWorkerManager } = {},
) {
  const router = Router();
  const heartbeat = heartbeatService(db, { pluginWorkerManager: options.pluginWorkerManager });
  const ledger = policyLedgerService(db, {
    // Same cancel hook the budget hard-stop uses; scoped to the agent here.
    cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
    onBoardAlert: async (alert) => {
      await logActivity(db, {
        companyId: alert.companyId,
        actorType: "system",
        actorId: "policy-ledger",
        agentId: alert.agentId,
        action: "employee_policy.monthly_budget_exceeded",
        entityType: "employee_policy",
        entityId: alert.policyId ?? alert.agentId,
        details: { monthlyBudgetUnits: alert.monthlyBudgetUnits, unit: alert.unit },
      });
    },
  });

  // --- Adapter manifests (board) ---------------------------------------

  router.post("/policy-ledger/adapters", validate(upsertManifestSchema), async (req, res) => {
    assertBoard(req);
    const manifest = await ledger.upsertManifest(req.body);
    res.status(201).json(manifest);
  });

  router.get("/policy-ledger/adapters", async (_req, res) => {
    const manifests = await ledger.listManifests();
    res.json(manifests);
  });

  // --- Employee policy (board) -----------------------------------------

  router.post(
    "/companies/:companyId/agents/:agentId/policy",
    validate(setPolicySchema),
    async (req, res) => {
      const { companyId, agentId } = req.params as { companyId: string; agentId: string };
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const policy = await ledger.setPolicy(companyId, agentId, req.body, req.actor.userId ?? "board");
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId,
        action: "employee_policy.set",
        entityType: "employee_policy",
        entityId: policy.id,
        details: { monthlyBudgetUnits: policy.monthlyBudgetUnits, unit: policy.unit },
      });
      res.status(201).json(policy);
    },
  );

  router.get("/companies/:companyId/agents/:agentId/policy", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);
    const policy = await ledger.getActivePolicy(companyId, agentId);
    if (!policy) {
      res.status(404).json({ error: "Employee has no active policy" });
      return;
    }
    res.json(policy);
  });

  // --- Credentials (board) ---------------------------------------------

  router.post("/companies/:companyId/agents/:agentId/credential", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    const { credential, token } = await ledger.issueCredential(
      companyId,
      agentId,
      req.actor.userId ?? "board",
    );
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId,
      action: "employee_credential.issued",
      entityType: "employee_credential",
      entityId: credential.id,
      details: { prefix: credential.prefix, policyId: credential.policyId },
    });
    // Plaintext token returned exactly once.
    res.status(201).json({ credential, token });
  });

  router.post(
    "/companies/:companyId/credentials/:credentialId/revoke",
    validate(revokeSchema),
    async (req, res) => {
      const { companyId, credentialId } = req.params as { companyId: string; credentialId: string };
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const credential = await ledger.revokeCredential(credentialId, req.body.reason ?? null);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: credential.agentId,
        action: "employee_credential.revoked",
        entityType: "employee_credential",
        entityId: credential.id,
        details: { generation: credential.generation, reason: credential.revokedReason },
      });
      res.json(credential);
    },
  );

  // --- Authorize / settle (gateway hot path) ---------------------------

  router.post(
    "/companies/:companyId/agents/:agentId/authorize",
    validate(authorizeSchema),
    async (req, res) => {
      const { companyId, agentId } = req.params as { companyId: string; agentId: string };
      assertCompanyAccess(req, companyId);
      // An agent may only authorize its own calls; the board may authorize any.
      if (req.actor.type === "agent" && req.actor.agentId !== agentId) {
        res.status(403).json({ error: "Agent can only authorize its own calls" });
        return;
      }
      const decision = await ledger.authorize(companyId, agentId, req.body);
      res.status(decision.ok ? 201 : 402).json(decision);
    },
  );

  router.post(
    "/companies/:companyId/settle",
    validate(settleSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const result = await ledger.settle(companyId, req.body);
      res.status(201).json(result);
    },
  );

  // --- Spend / ledger reads (company) ----------------------------------

  router.get("/companies/:companyId/agents/:agentId/spend", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);
    const spend = await ledger.employeeSpend(companyId, agentId);
    res.json(spend);
  });

  router.get("/companies/:companyId/agents/:agentId/ledger", async (req, res) => {
    const { companyId, agentId } = req.params as { companyId: string; agentId: string };
    assertCompanyAccess(req, companyId);
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const entries = await ledger.listLedger(companyId, agentId, limit);
    res.json(entries);
  });

  return router;
}
