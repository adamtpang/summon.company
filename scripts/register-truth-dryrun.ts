/**
 * Dry run of the webhook path.
 *
 * Simulates a `pull_request.closed` with `merged: true`, drives the real
 * runner against a READ-ONLY clone, and prints the task and the proposed
 * register diff that would be produced. No database, no task created, and
 * nothing written to the customer repo.
 *
 *   node cli/node_modules/tsx/dist/cli.mjs scripts/register-truth-dryrun.ts \
 *     --repo-dir <clone> --repo owner/name --register <path> --probes p.json
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  proposeRegisterEdit,
  renderReceipt,
  runReconciliation,
  shouldTriggerFromWebhook,
  type RunStore,
  type TaskFiler,
} from "../server/src/services/register-truth-runner.js";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const repoDir = arg("repo-dir");
const repo = arg("repo") ?? "unknown/unknown";
const registerPath = arg("register");
const probesFile = arg("probes");

if (!repoDir || !registerPath) {
  console.error("usage: --repo-dir <path> --repo <owner/name> --register <path> [--probes f.json]");
  process.exit(2);
}

const probes = probesFile ? JSON.parse(readFileSync(probesFile, "utf-8")) : undefined;

// 1. The event a GitHub App would deliver.
const event = {
  name: "pull_request",
  payload: {
    action: "closed",
    pull_request: { merged: true, number: 2529, title: "ci: scope PR turbo runs" },
    repository: { full_name: repo },
  },
};

console.log("=== 1. incoming webhook ===");
console.log(`event: ${event.name}  action: ${event.payload.action}  merged: ${event.payload.pull_request.merged}`);
const triggers = shouldTriggerFromWebhook(event.name, event.payload);
console.log(`triggers a run: ${triggers}`);
if (!triggers) process.exit(0);

// 2. Dry-run seams: history is consulted, nothing is persisted or filed.
const seen = new Set<string>();
const store: RunStore = {
  hasRun: async (r, p, head) => seen.has(`${r}:${p}:${head}`),
  record: async (row) => {
    seen.add(`${row.repo}:${row.registerPath}:${row.receipt.headCommit}`);
    console.log(`\n=== 3. history row (NOT written, dry run) ===`);
    console.log(
      `repo=${row.repo} register=${row.registerPath} head=${row.receipt.headCommit} ` +
        `trigger=${row.trigger} mode=${row.mode}`,
    );
  },
};

const filer: TaskFiler = {
  file: async (input) => {
    console.log(`\n=== 4. task that WOULD be filed (dry run, none created) ===`);
    console.log(`title:    ${input.title}`);
    console.log(`priority: ${input.priority}`);
    console.log(`company:  ${input.companyId}`);
    console.log("--- body ---");
    console.log(input.description);
    return null;
  },
};

console.log("\n=== 2. reconciling (read-only) ===");
const outcome = await runReconciliation(
  {
    companyId: "dry-run-company",
    repoDir,
    repo,
    registerPath,
    probes,
    trigger: "webhook",
    mode: "propose_only",
  },
  { store, filer },
);

if (!outcome.ran) {
  console.log(`skipped: ${outcome.skippedReason}`);
  process.exit(0);
}

// 5. The proposed doc PR, generated from the register at head. Read-only.
if (outcome.receipt) {
  const show = spawnSync(
    "git",
    ["show", `origin/${outcome.receipt.headBranch}:${registerPath}`],
    { cwd: repoDir, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 },
  );
  const registerText = show.stdout ?? "";
  const { diff } = proposeRegisterEdit(registerText, outcome.receipt);

  console.log(`\n=== 5. proposed doc PR (propose-only, NOT opened) ===`);
  console.log(`branch that would be created: summon/register-truth-${outcome.receipt.headCommit}`);
  console.log(`title: docs: reconcile ${registerPath} against ${outcome.receipt.headCommit}`);
  console.log("--- diff ---");
  console.log(diff || "(no changes proposed)");
}

console.log(`\n=== 6. second delivery of the same event (idempotency) ===`);
const second = await runReconciliation(
  {
    companyId: "dry-run-company",
    repoDir,
    repo,
    registerPath,
    probes,
    trigger: "webhook",
    mode: "propose_only",
  },
  { store, filer },
);
console.log(`ran: ${second.ran}  reason: ${second.skippedReason ?? "n/a"}`);

console.log(`\nnothing was written to ${repo}. propose-only mode.`);
void renderReceipt;
