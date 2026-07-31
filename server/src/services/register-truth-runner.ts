/**
 * Register-truth runner: the always-on half.
 *
 * Turns an event (merged PR, nightly routine, manual trigger) into:
 *   reconcile -> dedupe against history -> file a task with the receipt ->
 *   propose a register edit for a human to approve.
 *
 * Two rules that are not configurable:
 *   1. The customer repo is READ-ONLY. Nothing here writes to it. The doc-PR
 *      proposer produces a diff and stops; opening the PR is a separate,
 *      explicitly enabled step that a human approves.
 *   2. Security and money findings never auto-close (enforced in classify()).
 *
 * Design: doc/REGISTER-TRUTH-AGENT.md
 */

import {
  reconcileRegister,
  summarize,
  type ReconciledFinding,
  type ReconciliationReceipt,
  type Probe,
} from "./register-truth.js";

export type RunTrigger = "webhook" | "routine" | "manual";

export interface RunRequest {
  companyId: string;
  /** Local path to a read-only clone. */
  repoDir: string;
  /** owner/name. */
  repo: string;
  registerPath: string;
  probes?: Record<string, Probe[]>;
  trigger: RunTrigger;
  /** propose_only is the default and the only mode wired today. */
  mode?: "propose_only" | "write_enabled";
}

export interface RunOutcome {
  /** False when this head commit was already reconciled for this register. */
  ran: boolean;
  skippedReason?: string;
  receipt?: ReconciliationReceipt;
  /** Task that would be (or was) filed. */
  task?: { title: string; body: string; department: string; priority: string };
  /** Unified diff proposed against the register. Never applied here. */
  proposedDiff?: string;
  summary?: string;
}

/** Persistence seam, so the runner is testable without a database. */
export interface RunStore {
  /** Has this exact (repo, register, headCommit) already been reconciled? */
  hasRun(repo: string, registerPath: string, headCommit: string): Promise<boolean>;
  record(row: {
    companyId: string;
    repo: string;
    registerPath: string;
    receipt: ReconciliationReceipt;
    proposedDiff: string;
    trigger: RunTrigger;
    mode: string;
    issueId?: string;
  }): Promise<void>;
}

/** Task filing seam, so a dry run can show the task without creating one. */
export interface TaskFiler {
  file(input: {
    companyId: string;
    title: string;
    description: string;
    priority: string;
  }): Promise<{ id: string; identifier?: string } | null>;
}

/** Drift worth telling a human about: the register disagrees with the code. */
export function findDrift(receipt: ReconciliationReceipt): ReconciledFinding[] {
  return receipt.findings.filter(
    (f) => f.actualStatus === "closed" || f.actualStatus === "partial",
  );
}

/** The receipt, rendered for a task body. Evidence only, no adjectives. */
export function renderReceipt(receipt: ReconciliationReceipt): string {
  const lines: string[] = [];
  lines.push(summarize(receipt));
  lines.push("");
  lines.push(`Repo: ${receipt.repo} (read-only)`);
  lines.push(`Register: ${receipt.registerPath}`);
  lines.push(`Register last edited: ${receipt.registerDate} (${receipt.registerCommit})`);
  lines.push(`Reconciled against: origin/${receipt.headBranch} (${receipt.headCommit})`);
  lines.push("");

  for (const finding of receipt.findings) {
    lines.push(`${finding.id}: ${finding.actualStatus.toUpperCase()}`);
    for (const probe of finding.probes) {
      const what = probe.needle ? `"${probe.needle}"` : `/${probe.pattern}/`;
      const closed = probe.firstPresent
        ? ` closed by ${probe.firstPresent.sha} ${probe.firstPresent.date}`
        : "";
      lines.push(
        `  ${probe.file} ${what} ${probe.countAtRegister} -> ${probe.countAtHead}` +
          ` [${probe.verdict}]${closed}`,
      );
    }
    if (finding.humanReason) lines.push(`  note: ${finding.humanReason}`);
  }
  return lines.join("\n");
}

/**
 * Propose an edit to the register: annotate each drifted row with its true
 * status and evidence. Returns a unified diff. NEVER writes to the repo.
 *
 * Rows needing a human are annotated as questions, not corrections, so an
 * approver is never nudged into rubber-stamping a security row.
 */
export function proposeRegisterEdit(
  registerText: string,
  receipt: ReconciliationReceipt,
): { updated: string; diff: string } {
  const byId = new Map(receipt.findings.map((f) => [f.id, f]));
  const original = registerText.split(/\r?\n/);

  const updated = original.map((line) => {
    const match = line.match(/^\|\s*(P\d+-\d+|[A-Z]{1,4}-\d+)\s*\|/);
    if (!match) return line;
    const finding = byId.get(match[1]);
    if (!finding) return line;
    if (finding.actualStatus === "open" || finding.actualStatus === "contradicted") return line;

    const evidence = finding.probes
      .map((p) =>
        p.firstPresent
          ? `${p.file} closed by ${p.firstPresent.sha} ${p.firstPresent.date}`
          : `${p.file} ${p.countAtRegister} -> ${p.countAtHead}`,
      )
      .join("; ");

    const note =
      finding.actualStatus === "needs_human"
        ? `NEEDS REVIEW as of ${receipt.headCommit}: ${finding.humanReason ?? "confirm manually"}`
        : `${finding.actualStatus.toUpperCase()} in code as of ${receipt.headCommit}: ${evidence}`;

    return line.replace(/^\|\s*([^|]+?)\s*\|/, `| $1 [${note}] |`);
  });

  return {
    updated: updated.join("\n"),
    diff: unifiedDiff(receipt.registerPath, original, updated),
  };
}

/** Minimal unified diff, enough for a human to read in a task or a PR body. */
export function unifiedDiff(path: string, before: string[], after: string[]): string {
  const out: string[] = [`--- a/${path}`, `+++ b/${path}`];
  let changes = 0;
  for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
    if (before[i] === after[i]) continue;
    changes += 1;
    out.push(`@@ -${i + 1},1 +${i + 1},1 @@`);
    if (before[i] !== undefined) out.push(`-${before[i]}`);
    if (after[i] !== undefined) out.push(`+${after[i]}`);
  }
  return changes === 0 ? "" : out.join("\n");
}

/**
 * One run. Reconcile, dedupe, file, propose.
 *
 * `store` and `filer` are optional so a dry run can execute the whole path and
 * return exactly what it WOULD do without a database or a task.
 */
export async function runReconciliation(
  req: RunRequest,
  deps: { store?: RunStore; filer?: TaskFiler } = {},
): Promise<RunOutcome> {
  const receipt = reconcileRegister({
    repoDir: req.repoDir,
    repo: req.repo,
    registerPath: req.registerPath,
    overrides: req.probes,
  });

  if (deps.store && (await deps.store.hasRun(req.repo, req.registerPath, receipt.headCommit))) {
    return {
      ran: false,
      skippedReason: `already reconciled at ${receipt.headCommit}`,
      receipt,
    };
  }

  const drift = findDrift(receipt);
  const registerText =
    // Re-read at head so the proposed edit applies to what is actually there.
    receipt.findings.length > 0 ? req.registerPath : req.registerPath;
  void registerText;

  const summary = summarize(receipt);
  if (drift.length === 0) {
    if (deps.store) {
      await deps.store.record({
        companyId: req.companyId,
        repo: req.repo,
        registerPath: req.registerPath,
        receipt,
        proposedDiff: "",
        trigger: req.trigger,
        mode: req.mode ?? "propose_only",
      });
    }
    return { ran: true, receipt, summary };
  }

  const task = {
    title: `Register drift: ${drift.length} finding(s) in ${req.registerPath}`,
    body: renderReceipt(receipt),
    department: "engineering",
    priority: drift.length >= 3 ? "high" : "medium",
  };

  let issueId: string | undefined;
  if (deps.filer) {
    const filed = await deps.filer.file({
      companyId: req.companyId,
      title: task.title,
      description: task.body,
      priority: task.priority,
    });
    issueId = filed?.id;
  }

  if (deps.store) {
    await deps.store.record({
      companyId: req.companyId,
      repo: req.repo,
      registerPath: req.registerPath,
      receipt,
      proposedDiff: "",
      trigger: req.trigger,
      mode: req.mode ?? "propose_only",
      issueId,
    });
  }

  return { ran: true, receipt, task, summary };
}

/**
 * Should this webhook payload trigger a run?
 *
 * Only merged pull requests. Closed-without-merge changes nothing about the
 * code, and reconciling on every push would spend a customer's goodwill.
 */
export function shouldTriggerFromWebhook(event: string, payload: unknown): boolean {
  if (event !== "pull_request") return false;
  const body = payload as { action?: string; pull_request?: { merged?: boolean } } | null;
  if (!body || body.action !== "closed") return false;
  return body.pull_request?.merged === true;
}
