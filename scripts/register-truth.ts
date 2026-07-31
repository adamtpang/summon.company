/**
 * Run the register-truth reconciler against a read-only clone.
 *
 *   node cli/node_modules/tsx/dist/cli.mjs scripts/register-truth.ts \
 *     --repo-dir <path> --repo owner/name --register <path-in-repo> \
 *     [--probes <file.json>] [--only P0-1,P0-2] [--json]
 *
 * Reads only. Never writes to the target repo.
 */

import { readFileSync } from "node:fs";

import {
  reconcileRegister,
  summarize,
  type Probe,
} from "../server/src/services/register-truth.js";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const repoDir = arg("repo-dir");
const repo = arg("repo") ?? "unknown/unknown";
const registerPath = arg("register");
const probesFile = arg("probes");
const only = arg("only")?.split(",").map((s) => s.trim());
const asJson = process.argv.includes("--json");

if (!repoDir || !registerPath) {
  console.error("usage: --repo-dir <path> --repo <owner/name> --register <path> [--probes f.json] [--only ids] [--json]");
  process.exit(2);
}

const overrides: Record<string, Probe[]> | undefined = probesFile
  ? JSON.parse(readFileSync(probesFile, "utf-8"))
  : undefined;

const receipt = reconcileRegister({ repoDir, repo, registerPath, overrides, only });

if (asJson) {
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(0);
}

const ICON: Record<string, string> = {
  closed: "CLOSED     ",
  partial: "PARTIAL    ",
  open: "OPEN       ",
  contradicted: "CONTRADICTED",
  needs_human: "NEEDS HUMAN",
};

console.log(`\n${repo}  register: ${registerPath}`);
console.log(`register last edited ${receipt.registerDate} (${receipt.registerCommit})`);
console.log(`reconciled against origin/${receipt.headBranch} (${receipt.headCommit})`);
console.log(`commits since the register was written: ${receipt.commitsSinceRegister}\n`);

for (const finding of receipt.findings) {
  console.log(`${ICON[finding.actualStatus] ?? finding.actualStatus}  ${finding.id}`);
  for (const probe of finding.probes) {
    const closed = probe.firstPresent
      ? `  closed by ${probe.firstPresent.sha} ${probe.firstPresent.date}`
      : "";
    const what = probe.needle
      ? `"${probe.needle}"`
      : `/${probe.pattern}/${probe.lines ? ` lines ${probe.lines[0]}-${probe.lines[1]}` : ""}`;
    console.log(
      `    ${probe.file}  ${what}  ${probe.countAtRegister} -> ${probe.countAtHead}` +
        `  [${probe.verdict}]${closed}`,
    );
  }
  if (finding.humanReason) console.log(`    note: ${finding.humanReason}`);
}

console.log(`\n${summarize(receipt)}\n`);
