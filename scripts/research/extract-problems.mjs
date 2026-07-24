#!/usr/bin/env node
// extract-problems.mjs — the SUM-211 extractor prototype.
// Scans an org's local clones for problems the company ALREADY documented:
// severity registers (P0/P1/Sev1/critical/blocker), named-problem language in
// docs (gap, audit, finding, remediation, tech debt, not production ready),
// and TODO/FIXME/HACK in source. Never invents: every finding is
// {repo, file, line, quote}. Ranks by severity weight with doc and
// register-file boosts.
//
// Guardrails (hard): code and docs only. Data-file extensions are refused
// outright, any file with heavy email/identifier density is refused and
// REPORTED, node_modules/.git/dist/vendor skipped, files over 512KB skipped.
//
// Usage: node extract-problems.mjs <orgDir> [top=30]

import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? "C:/Users/adamp/OneDrive/Aether/regain";
const TOP = Number(process.argv[3] ?? 30);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "vendor", "coverage", "__pycache__", ".venv", "venv", ".turbo"]);
const REFUSE_EXT = new Set([".csv", ".tsv", ".xlsx", ".xls", ".parquet", ".ndjson", ".db", ".sqlite", ".sqlite3", ".dump", ".bak", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".zip", ".gz", ".env"]);
const DOC_EXT = new Set([".md", ".adoc", ".rst", ".txt"]);
const CODE_EXT = new Set([".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".go", ".rs", ".java", ".rb", ".sh", ".yaml", ".yml", ".toml", ".sql", ".tf", ".proto"]);

const PATTERNS = [
  { re: /\b(P0|SEV[- ]?1|SEV1)\b/i, marker: "P0/Sev1", weight: 5 },
  { re: /\b(critical|blocker|data loss|outage)\b/i, marker: "critical", weight: 5 },
  { re: /\b(P1|SEV[- ]?2)\b/, marker: "P1/Sev2", weight: 4 },
  { re: /\b(security (risk|issue|hole|gap)|vulnerab|CVE-\d{4})\b/i, marker: "security", weight: 5 },
  { re: /\bnot (production[- ]ready|prod[- ]ready)\b/i, marker: "not-prod-ready", weight: 4 },
  { re: /\b(remediation|findings? register|audit finding|readiness (gap|review))\b/i, marker: "remediation/audit", weight: 4 },
  { re: /\b(known issue|known bug|tech(nical)? debt)\b/i, marker: "known-issue/debt", weight: 3 },
  { re: /\bP2\b/, marker: "P2", weight: 3 },
  { re: /\b(FIXME|HACK|XXX)\b/, marker: "FIXME/HACK", weight: 2, codeOnly: true },
  { re: /\bTODO\b/, marker: "TODO", weight: 1, codeOnly: true },
];

const REGISTER_FILE = /(finding|register|audit|remediat|readiness|compliance|security|postmortem|incident)/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const findings = [];
const refused = [];
const perRepo = {};
let filesScanned = 0;

function walk(dir, repo) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path.join(dir, e.name), repo);
      continue;
    }
    const full = path.join(dir, e.name);
    const ext = path.extname(e.name).toLowerCase();
    if (REFUSE_EXT.has(ext)) { if ([".csv", ".tsv", ".xlsx", ".ndjson", ".db", ".sqlite", ".dump"].includes(ext)) refused.push(rel(full) + " (data extension)"); continue; }
    const isDoc = DOC_EXT.has(ext) || /^readme|^changelog/i.test(e.name);
    const isCode = CODE_EXT.has(ext);
    if (!isDoc && !isCode) continue;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.size > 512 * 1024) continue;
    let text;
    try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
    const emails = text.match(EMAIL_RE);
    if (emails && emails.length > 20) { refused.push(rel(full) + ` (${emails.length} email-like strings)`); continue; }
    filesScanned++;
    scan(text, full, repo, isDoc);
  }
}

function rel(full) { return path.relative(ROOT, full).replace(/\\/g, "/"); }

function scan(text, full, repo, isDoc) {
  const lines = text.split(/\r?\n/);
  const file = rel(full);
  const inRegister = REGISTER_FILE.test(file);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 400) continue;
    for (const p of PATTERNS) {
      if (p.codeOnly && isDoc) continue;
      if (!p.re.test(line)) continue;
      let score = p.weight + (isDoc ? 1 : 0) + (inRegister ? 2 : 0);
      findings.push({ repo, file, line: i + 1, marker: p.marker, score, quote: line.trim().slice(0, 160) });
      perRepo[repo] = (perRepo[repo] ?? 0) + 1;
      break;
    }
  }
}

for (const repo of fs.readdirSync(ROOT)) {
  const dir = path.join(ROOT, repo);
  try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }
  walk(dir, repo);
}

const tier = (s) => (s >= 7 ? "S" : s >= 6 ? "A" : s >= 5 ? "B" : s >= 4 ? "C" : "D");
findings.sort((a, b) => b.score - a.score);

// Cluster: one row per (file, marker) with count, keep the best quote.
const clusters = new Map();
for (const f of findings) {
  const key = f.file + "::" + f.marker;
  const c = clusters.get(key);
  if (c) { c.count++; if (f.score > c.score) { c.score = f.score; c.quote = f.quote; c.line = f.line; } }
  else clusters.set(key, { ...f, count: 1 });
}
const ranked = [...clusters.values()].sort((a, b) => b.score - a.score || b.count - a.count);

console.log(`SCANNED ${filesScanned} files across ${Object.keys(perRepo).length + (findings.length ? 0 : 0)} repos with findings; ${findings.length} raw findings, ${ranked.length} clusters; ${refused.length} files refused.\n`);
console.log("TOP RANKED PROBLEM CLUSTERS (tier | score | repo | file:line | marker xN | evidence quote)\n");
for (const r of ranked.slice(0, TOP)) {
  console.log(`${tier(r.score)} ${r.score} | ${r.repo} | ${r.file}:${r.line} | ${r.marker} x${r.count}`);
  console.log(`    "${r.quote}"`);
}
console.log("\nFINDINGS PER REPO:", JSON.stringify(perRepo));
if (refused.length) {
  console.log("\nREFUSED FILES (guardrail):");
  for (const r of refused.slice(0, 15)) console.log("  " + r);
  if (refused.length > 15) console.log(`  ...and ${refused.length - 15} more`);
}
