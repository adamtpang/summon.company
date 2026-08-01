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

import { reconcileRegister, type Probe } from "../server/src/services/register-truth.js";
import { renderReceipt } from "../server/src/services/register-truth-runner.js";

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
  console.error(
    "usage: --repo-dir <path> --repo <owner/name> --register <path> [--probes f.json] [--only ids] [--json]",
  );
  process.exit(2);
}

const overrides: Record<string, Probe[]> | undefined = probesFile
  ? JSON.parse(readFileSync(probesFile, "utf-8"))
  : undefined;

const receipt = reconcileRegister({ repoDir, repo, registerPath, overrides, only });

if (asJson) {
  // The register text is on the receipt for the diff proposer; keep CLI JSON lean.
  const { registerText: _registerText, ...lean } = receipt;
  console.log(JSON.stringify(lean, null, 2));
} else {
  console.log(`\n${renderReceipt(receipt)}\n`);
}
