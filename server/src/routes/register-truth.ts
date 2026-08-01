import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";

import { registerReconciliations, type Db } from "@paperclipai/db";
import { registerTruthRunSchema, type RegisterTruthRunPayload } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { issueService, logActivity } from "../services/index.js";
import {
  countByStatus,
  runReconciliation,
  shouldTriggerFromWebhook,
  type RunStore,
  type RunTrigger,
  type TaskFiler,
} from "../services/register-truth-runner.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

/**
 * Register-truth routes: read the history, trigger a run, receive a webhook.
 *
 * Customer repos are read-only. Runs reconcile and file a task; they never
 * write to the customer's repo, and propose-only is the only mode served.
 *
 * The webhook sink is an interim manual-test surface: real GitHub delivery
 * belongs at the plugin-webhook altitude with signature verification and
 * server-side per-company config (doc/REGISTER-TRUTH-AGENT.md). It stays
 * inert for real GitHub traffic because the run config cannot arrive from
 * GitHub, only from an operator.
 */
export function registerTruthRoutes(db: Db) {
  const router = Router();
  const issues = issueService(db);

  const store: RunStore = {
    async hasRun(repo, registerPath, headCommit) {
      const rows = await db
        .select({ id: registerReconciliations.id })
        .from(registerReconciliations)
        .where(
          and(
            eq(registerReconciliations.repo, repo),
            eq(registerReconciliations.registerPath, registerPath),
            eq(registerReconciliations.headCommit, headCommit),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
    async record(row) {
      const counts = countByStatus(row.receipt);
      await db
        .insert(registerReconciliations)
        .values({
          companyId: row.companyId,
          repo: row.repo,
          registerPath: row.registerPath,
          registerCommit: row.receipt.registerCommit,
          headCommit: row.receipt.headCommit,
          headBranch: row.receipt.headBranch,
          commitsSinceRegister: row.receipt.commitsSinceRegister,
          findingsTotal: counts.total,
          findingsClosed: counts.closed,
          findingsPartial: counts.partial,
          findingsNeedsHuman: counts.needsHuman,
          receipt: row.receipt as unknown as Record<string, unknown>,
          proposedDiff: row.proposedDiff,
          trigger: row.trigger,
          issueId: row.issueId,
        })
        .onConflictDoNothing();
    },
  };

  const filer: TaskFiler = {
    async file(input) {
      const issue = await issues.create(input.companyId, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "todo",
      });
      return issue ? { id: issue.id, identifier: issue.identifier } : null;
    },
  };

  async function runOnce(companyId: string, payload: RegisterTruthRunPayload, trigger: RunTrigger) {
    const outcome = await runReconciliation(
      {
        companyId,
        repoDir: payload.repoDir,
        repo: payload.repo,
        registerPath: payload.registerPath,
        probes: payload.probes,
        trigger,
      },
      { store, filer },
    );
    return outcome;
  }

  /** History for a company, newest first. Summary columns only; the receipt
   *  jsonb is heavy (every claim and probe) and served per-row below. */
  router.get("/companies/:companyId/register-truth/reconciliations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const rows = await db
      .select({
        id: registerReconciliations.id,
        repo: registerReconciliations.repo,
        registerPath: registerReconciliations.registerPath,
        registerCommit: registerReconciliations.registerCommit,
        headCommit: registerReconciliations.headCommit,
        headBranch: registerReconciliations.headBranch,
        commitsSinceRegister: registerReconciliations.commitsSinceRegister,
        findingsTotal: registerReconciliations.findingsTotal,
        findingsClosed: registerReconciliations.findingsClosed,
        findingsPartial: registerReconciliations.findingsPartial,
        findingsNeedsHuman: registerReconciliations.findingsNeedsHuman,
        trigger: registerReconciliations.trigger,
        status: registerReconciliations.status,
        issueId: registerReconciliations.issueId,
        createdAt: registerReconciliations.createdAt,
      })
      .from(registerReconciliations)
      .where(eq(registerReconciliations.companyId, companyId))
      .orderBy(desc(registerReconciliations.createdAt))
      .limit(50);
    res.json(rows);
  });

  /** One reconciliation with its full receipt and proposed diff. */
  router.get(
    "/companies/:companyId/register-truth/reconciliations/:id",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(registerReconciliations)
        .where(
          and(
            eq(registerReconciliations.companyId, companyId),
            eq(registerReconciliations.id, req.params.id as string),
          ),
        )
        .limit(1);
      if (rows.length === 0) {
        res.status(404).json({ error: "Reconciliation not found" });
        return;
      }
      res.json(rows[0]);
    },
  );

  /** Manual trigger. Same path a webhook takes. */
  router.post(
    "/companies/:companyId/register-truth/run",
    validate(registerTruthRunSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      try {
        const outcome = await runOnce(companyId, req.body as RegisterTruthRunPayload, "manual");
        const actor = getActorInfo(req);
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          action: "register_truth.run",
          entityType: "register_reconciliation",
          entityId: outcome.receipt?.headCommit ?? "skipped",
          details: {
            repo: (req.body as RegisterTruthRunPayload).repo,
            ran: outcome.ran,
            drift: outcome.task?.title ?? null,
          },
        });
        res.json(outcome);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  /**
   * Webhook sink. Only merged pull requests do anything; everything else is
   * acknowledged so the sender stops redelivering. Accepted runs return 202
   * immediately and reconcile after the response, because a run shells out to
   * git and a webhook sender times out in seconds (same accept-then-run shape
   * as the company import route).
   */
  router.post("/companies/:companyId/register-truth/webhook", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const event = String(req.header("x-github-event") ?? "");
    if (!shouldTriggerFromWebhook(event, req.body)) {
      res.status(202).json({ ignored: true, reason: "not a merged pull request" });
      return;
    }
    const parsed = registerTruthRunSchema.safeParse(req.body?.summon ?? {});
    if (!parsed.success) {
      res.status(202).json({ ignored: true, reason: "repo not configured for register-truth" });
      return;
    }
    res.status(202).json({ accepted: true });
    setImmediate(() => {
      void runOnce(companyId, parsed.data, "webhook").catch(() => {
        // Failures land in server logs; a delivery-status row is the plugin
        // altitude's job when the real GitHub App integration ships.
      });
    });
  });

  return router;
}
