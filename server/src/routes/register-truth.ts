import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";

import { registerReconciliations, type Db } from "@paperclipai/db";
import {
  runReconciliation,
  shouldTriggerFromWebhook,
  type RunStore,
} from "../services/register-truth-runner.js";

/**
 * Register-truth routes: read the history, trigger a run, receive a webhook.
 *
 * Customer repos are read-only. The webhook route reconciles and files a task;
 * it never writes to the customer's repo, and propose_only is the only mode
 * these routes accept today.
 */
export function registerTruthRoutes(db: Db) {
  const router = Router();

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
      const counts = row.receipt.findings.reduce(
        (acc, f) => {
          if (f.actualStatus === "closed") acc.closed += 1;
          else if (f.actualStatus === "partial") acc.partial += 1;
          else if (f.actualStatus === "needs_human") acc.human += 1;
          return acc;
        },
        { closed: 0, partial: 0, human: 0 },
      );

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
          findingsTotal: row.receipt.findings.length,
          findingsClosed: counts.closed,
          findingsPartial: counts.partial,
          findingsNeedsHuman: counts.human,
          receipt: row.receipt as unknown as Record<string, unknown>,
          proposedDiff: row.proposedDiff,
          trigger: row.trigger,
          mode: row.mode,
          issueId: row.issueId,
        })
        .onConflictDoNothing();
    },
  };

  /** History for a company, newest first. */
  router.get("/companies/:companyId/register-truth/reconciliations", async (req, res) => {
    const rows = await db
      .select()
      .from(registerReconciliations)
      .where(eq(registerReconciliations.companyId, req.params.companyId as string))
      .orderBy(desc(registerReconciliations.createdAt))
      .limit(50);
    res.json(rows);
  });

  /** Manual trigger. Same path the webhook takes. */
  router.post("/companies/:companyId/register-truth/run", async (req, res) => {
    const { repoDir, repo, registerPath, probes } = req.body ?? {};
    if (!repoDir || !repo || !registerPath) {
      res.status(422).json({ error: "repoDir, repo and registerPath are required" });
      return;
    }
    try {
      const outcome = await runReconciliation(
        {
          companyId: req.params.companyId as string,
          repoDir,
          repo,
          registerPath,
          probes,
          trigger: "manual",
          mode: "propose_only",
        },
        { store },
      );
      res.json(outcome);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * Webhook sink. Only merged pull requests do anything; everything else is
   * acknowledged and ignored so GitHub stops redelivering.
   */
  router.post("/companies/:companyId/register-truth/webhook", async (req, res) => {
    const event = String(req.header("x-github-event") ?? "");
    if (!shouldTriggerFromWebhook(event, req.body)) {
      res.status(202).json({ ignored: true, reason: "not a merged pull request" });
      return;
    }
    const { repoDir, registerPath, probes } = req.body?.summon ?? {};
    const repo = req.body?.repository?.full_name;
    if (!repoDir || !repo || !registerPath) {
      res.status(202).json({ ignored: true, reason: "repo not configured for register-truth" });
      return;
    }
    try {
      const outcome = await runReconciliation(
        {
          companyId: req.params.companyId as string,
          repoDir,
          repo,
          registerPath,
          probes,
          trigger: "webhook",
          mode: "propose_only",
        },
        { store },
      );
      res.json({ ran: outcome.ran, skippedReason: outcome.skippedReason, task: outcome.task });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
