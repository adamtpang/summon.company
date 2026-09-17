#!/usr/bin/env node
/**
 * codemod-retire-palette-classes.mjs
 *
 * Idempotent codemod: replace Tailwind palette color classes in
 * ui/src/components/ and ui/src/pages/ with semantic CSS custom-property
 * token references (Tailwind v4 syntax: text-(--token)).
 *
 * Clusters 1-7 as specified in run4 goal prompt.
 * Skip: *.test.tsx, *.test.ts, InviteLanding.tsx, OrgChart.tsx, lib/status-colors.ts
 *
 * Usage: node scripts/codemod-retire-palette-classes.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const UI_SRC = resolve(REPO_ROOT, "ui/src");
const DRY_RUN = process.argv.includes("--dry-run");

const SKIP_PATTERNS = [
  /\.test\.(tsx?|jsx?)$/,
  /InviteLanding\.tsx$/,
  /OrgChart\.tsx$/,
  /lib[/\\]status-colors\.ts$/,
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((re) => re.test(filePath));
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
}

function listFiles() {
  const files = [];
  for (const dir of ["components", "pages"]) walk(resolve(UI_SRC, dir), files);
  return files.filter((f) => !shouldSkip(f));
}

// ── Replacement rules ───────────────────────────────────────────────────────
// Each rule: { from: RegExp, to: string }
// Rules are applied in order; idempotent because CSS custom property syntax
// won't match any of the source patterns.
//
// We handle "base dark:" pairs first (combined replacement), then singles.

// Helper to build a regex that matches a class in JSX className context.
// Matches the class as a standalone token (space/quote/{ boundary).
// We use a global replace so all occurrences in a file are replaced.

function cls(pattern) {
  // Match class token: preceded by whitespace or quote/backtick/{ and followed by whitespace or quote/backtick/}
  return new RegExp(`(?<=[\\s"'\`{])${pattern}(?=[\\s"'\`}])`, "g");
}

const RULES = [
  // ── Cluster 1: Red/Rose ─────────────────────────────────────────────────

  // Combined "base dark:" patterns - drop the dark: variant
  { from: /text-red-600 dark:text-red-400/g, to: "text-(--destructive)" },
  { from: /text-red-700 dark:text-red-400/g, to: "text-(--destructive)" },
  { from: /text-rose-600 dark:text-rose-400/g, to: "text-(--destructive)" },

  // text (all shades)
  { from: /\btext-red-\d{2,3}\b/g, to: "text-(--destructive)" },
  { from: /\btext-rose-\d{2,3}\b/g, to: "text-(--destructive)" },

  // stroke/fill
  { from: /\bstroke-red-\d{2,3}\b/g, to: "stroke-(--destructive)" },
  { from: /\bfill-red-\d{2,3}\b/g, to: "fill-(--destructive)" },

  // bg solid - 400/500/600/700
  { from: /\bbg-red-(?:400|500|600|700)\b/g, to: "bg-(--status-task-blocked)" },
  { from: /\bbg-rose-(?:400|500|600|700)\b/g, to: "bg-(--status-task-blocked)" },
  // bg light tints - 50/100/200/300
  { from: /\bbg-red-(?:50|100|200|300)\b/g, to: "bg-(--destructive)/10" },
  { from: /\bbg-rose-(?:50|100|200|300)\b/g, to: "bg-(--destructive)/10" },
  // bg dark - 800/900/950
  { from: /\bbg-red-(?:800|900|950)\b/g, to: "bg-(--destructive)/10" },
  { from: /\bbg-rose-(?:800|900|950)\b/g, to: "bg-(--destructive)/10" },

  // border/ring
  { from: /\bborder-red-(?:50|100|200|300)\b/g, to: "border-(--destructive)/20" },
  { from: /\bborder-red-(?:400|500|600|700|800|900|950)\b/g, to: "border-(--destructive)" },
  { from: /\bborder-rose-(?:50|100|200|300)\b/g, to: "border-(--destructive)/20" },
  { from: /\bborder-rose-(?:400|500|600|700|800|900|950)\b/g, to: "border-(--destructive)" },
  { from: /\bring-red-\d{2,3}\b/g, to: "ring-(--destructive)" },
  { from: /\bring-rose-\d{2,3}\b/g, to: "ring-(--destructive)" },

  // ── Cluster 2: Green/Emerald ─────────────────────────────────────────────

  { from: /\btext-(?:green|emerald)-\d{2,3}\b/g, to: "text-(--status-task-done)" },
  { from: /\bfill-(?:green|emerald)-\d{2,3}\b/g, to: "fill-(--status-task-done)" },
  { from: /\bstroke-(?:green|emerald)-\d{2,3}\b/g, to: "stroke-(--status-task-done)" },
  // bg solid - 400/500/600/700/800
  { from: /\bbg-(?:green|emerald)-(?:400|500|600|700|800)\b/g, to: "bg-(--status-task-done)" },
  // bg light tints - 50/100/200/300
  { from: /\bbg-(?:green|emerald)-(?:50|100|200|300)\b/g, to: "bg-(--status-task-done)/10" },
  // bg dark - 900/950
  { from: /\bbg-(?:green|emerald)-(?:900|950)\b/g, to: "bg-(--status-task-done)/10" },
  { from: /\bborder-(?:green|emerald)-\d{2,3}\b/g, to: "border-(--status-task-done)/30" },
  { from: /\bring-(?:green|emerald)-\d{2,3}\b/g, to: "ring-(--status-task-done)" },

  // ── Cluster 3: Amber/Yellow ──────────────────────────────────────────────

  { from: /\btext-(?:amber|yellow)-\d{2,3}\b/g, to: "text-(--status-task-todo)" },
  { from: /\bfill-(?:amber|yellow)-\d{2,3}\b/g, to: "fill-(--status-task-todo)" },
  { from: /\bstroke-(?:amber|yellow)-\d{2,3}\b/g, to: "stroke-(--status-task-todo)" },
  // bg solid - 300/400/500/600/700
  { from: /\bbg-(?:amber|yellow)-(?:300|400|500|600|700)\b/g, to: "bg-(--status-task-todo)" },
  // bg light tints - 50/100/200
  { from: /\bbg-(?:amber|yellow)-(?:50|100|200)\b/g, to: "bg-(--status-task-todo)/10" },
  // bg dark - 800/900/950
  { from: /\bbg-(?:amber|yellow)-(?:800|900|950)\b/g, to: "bg-(--status-task-todo)/10" },
  { from: /\bborder-(?:amber|yellow)-\d{2,3}\b/g, to: "border-(--status-task-todo)/30" },
  { from: /\bring-(?:amber|yellow)-\d{2,3}\b/g, to: "ring-(--status-task-todo)" },

  // ── Cluster 4: Blue/Sky/Cyan/Indigo ─────────────────────────────────────

  { from: /\btext-(?:blue|sky|cyan|indigo)-\d{2,3}\b/g, to: "text-(--status-task-in_progress)" },
  { from: /\bfill-(?:blue|sky|cyan|indigo)-\d{2,3}\b/g, to: "fill-(--status-task-in_progress)" },
  { from: /\bstroke-(?:blue|sky|cyan|indigo)-\d{2,3}\b/g, to: "stroke-(--status-task-in_progress)" },
  // bg solid - 300/400/500/600/700
  { from: /\bbg-(?:blue|sky|cyan|indigo)-(?:300|400|500|600|700)\b/g, to: "bg-(--status-task-in_progress)" },
  // bg light tints - 50/100/200
  { from: /\bbg-(?:blue|sky|cyan|indigo)-(?:50|100|200)\b/g, to: "bg-(--status-task-in_progress)/10" },
  // bg dark - 800/900/950
  { from: /\bbg-(?:blue|sky|cyan|indigo)-(?:800|900|950)\b/g, to: "bg-(--status-task-in_progress)/10" },
  { from: /\bborder-(?:blue|sky|indigo|cyan)-\d{2,3}\b/g, to: "border-(--status-task-in_progress)/30" },
  // directional border variants: border-l-, border-r-, border-t-, border-b-
  { from: /\bborder-(l|r|t|b)-(blue|sky|cyan|indigo)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--status-task-in_progress)` },
  { from: /\bborder-(l|r|t|b)-(red|rose)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--destructive)` },
  { from: /\bborder-(l|r|t|b)-(green|emerald)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--status-task-done)` },
  { from: /\bborder-(l|r|t|b)-(amber|yellow|orange)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--status-task-todo)` },
  { from: /\bborder-(l|r|t|b)-(violet|purple)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--status-task-in_review)` },
  { from: /\bborder-(l|r|t|b)-(zinc|neutral|gray|slate)-\d{2,3}\b/g, to: (_, d) => `border-${d}-(--border)` },
  { from: /\bring-(?:blue|sky|cyan|indigo)-\d{2,3}\b/g, to: "ring-(--status-task-in_progress)" },

  // ── Cluster 5: Violet/Purple ─────────────────────────────────────────────

  { from: /\btext-(?:violet|purple)-\d{2,3}\b/g, to: "text-(--status-task-in_review)" },
  { from: /\bfill-(?:violet|purple)-\d{2,3}\b/g, to: "fill-(--status-task-in_review)" },
  { from: /\bstroke-(?:violet|purple)-\d{2,3}\b/g, to: "stroke-(--status-task-in_review)" },
  // bg solid - 400/500/600/700
  { from: /\bbg-(?:violet|purple)-(?:400|500|600|700)\b/g, to: "bg-(--status-task-in_review)" },
  // bg light tints - 50/100/200/300
  { from: /\bbg-(?:violet|purple)-(?:50|100|200|300)\b/g, to: "bg-(--status-task-in_review)/10" },
  // bg dark - 800/900/950
  { from: /\bbg-(?:violet|purple)-(?:800|900|950)\b/g, to: "bg-(--status-task-in_review)/10" },
  { from: /\bborder-(?:violet|purple)-\d{2,3}\b/g, to: "border-(--status-task-in_review)/30" },
  { from: /\bring-(?:violet|purple)-\d{2,3}\b/g, to: "ring-(--status-task-in_review)" },

  // ── Cluster 6: Zinc/Neutral/Slate/Gray ───────────────────────────────────

  { from: /\btext-(?:zinc|neutral|gray|slate)-(?:50|100|200|300|400|500|600)\b/g, to: "text-(--muted-foreground)" },
  { from: /\btext-(?:zinc|neutral|gray|slate)-(?:700|800|900|950)\b/g, to: "text-(--foreground)" },
  { from: /\bbg-(?:zinc|neutral|gray)-(?:50|100|200)\b/g, to: "bg-(--muted)" },
  { from: /\bbg-(?:zinc|neutral|gray)-(?:800|900)\b/g, to: "bg-(--card)" },
  { from: /\bbg-(?:zinc|neutral|gray|slate)-950\b/g, to: "bg-(--background)" },
  { from: /\bbg-neutral-950\b/g, to: "bg-(--background)" },
  { from: /\bborder-(?:zinc|neutral|gray|slate)-(?:50|100|200|300)\b/g, to: "border-(--border)" },
  { from: /\bborder-(?:zinc|neutral|gray|slate)-(?:400|500|600|700|800|900|950)\b/g, to: "border-(--border)" },
  { from: /\bring-(?:neutral|zinc|gray|slate)-\d{2,3}\b/g, to: "ring-(--border)" },

  // ── Cluster 7: Orange ────────────────────────────────────────────────────

  { from: /\btext-orange-\d{2,3}\b/g, to: "text-(--status-task-todo)" },
  { from: /\bfill-orange-\d{2,3}\b/g, to: "fill-(--status-task-todo)" },
  { from: /\bstroke-orange-\d{2,3}\b/g, to: "stroke-(--status-task-todo)" },
  { from: /\bbg-orange-(?:300|400|500|600|700)\b/g, to: "bg-(--status-task-todo)" },
  { from: /\bbg-orange-(?:50|100|200)\b/g, to: "bg-(--status-task-todo)/10" },
  { from: /\bbg-orange-(?:800|900|950)\b/g, to: "bg-(--status-task-todo)/10" },
  { from: /\bborder-orange-\d{2,3}\b/g, to: "border-(--status-task-todo)/30" },
  { from: /\bring-orange-\d{2,3}\b/g, to: "ring-(--status-task-todo)" },
];

function applyRules(content) {
  let out = content;
  for (const { from, to } of RULES) {
    out = out.replace(from, typeof to === "function" ? to : to);
  }
  return out;
}

let changed = 0;
let unchanged = 0;

for (const filePath of listFiles()) {
  const original = readFileSync(filePath, "utf8");
  const updated = applyRules(original);
  if (updated !== original) {
    changed++;
    if (!DRY_RUN) {
      writeFileSync(filePath, updated, "utf8");
    }
    const rel = relative(REPO_ROOT, filePath).split("\\").join("/");
    console.log(`${DRY_RUN ? "[dry] " : ""}patched  ${rel}`);
  } else {
    unchanged++;
  }
}

console.log(`\nDone. Changed: ${changed}, Unchanged: ${unchanged}${DRY_RUN ? " (dry run)" : ""}.`);
