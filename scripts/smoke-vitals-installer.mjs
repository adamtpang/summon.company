import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const installer = join(root, "apps", "landing", "bin", "init.mjs");
const target = mkdtempSync(join(tmpdir(), "vitals-installer-"));

try {
  const run = spawnSync(process.execPath, [installer, target], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || `installer exited ${run.status}`);
  }

  const required = [
    "index.html",
    "vitals.core.js",
    "vitals.css",
    "vitals.data.js",
    "SKILL.md",
    "schema.md",
  ];
  for (const file of required) {
    readFileSync(join(target, "vitals", file));
  }

  process.stdout.write(`Vitals installer smoke passed: ${required.length} files\n`);
} finally {
  rmSync(target, { recursive: true, force: true });
}
