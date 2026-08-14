/**
 * Register-truth eval suite: known-ground-truth scenarios run through the
 * real reconciler pipeline (reconcileRegister), not through classify() in
 * isolation. Unit tests in register-truth.test.ts already cover classify()
 * and measure() directly; this file exists to answer a different question:
 * "if you handed the reconciler a register with 12 findings whose true
 * status I already know, how many does it get right, and does it ever
 * auto-close a security or payment finding." That number is what backs the
 * "verified, not just built" claim in outreach.
 *
 * Every scenario supplies its own fake GitReader so no real git process or
 * network fetch runs. Ground truth (expectedStatus) is fixed by construction:
 * each scenario's file contents were written to produce exactly one verdict.
 *
 * Design: doc/REGISTER-TRUTH-AGENT.md
 */

import type { GitReader } from "./register-truth.js";
import type { FindingStatus } from "@paperclipai/shared";
import type { Probe } from "@paperclipai/shared";

export interface EvalScenario {
  id: string;
  /** What a human auditing the same evidence would conclude. */
  expectedStatus: FindingStatus;
  /** True for findings whose claim text should force needs_human regardless of evidence. */
  isSecurityOrMoney: boolean;
  /** One line on what this scenario is testing. */
  note: string;
}

const TABLE_REGISTER = `## Findings

| #       | Finding | Evidence | Verified |
| ------- | ------- | -------- | -------- |
| EVAL-1  | **Nightly sync job is dead code.** \`runNightlySync()\` has zero call sites. | \`eval/nightly.ts\` | ✓ |
| EVAL-2  | **RU locale leaks English.** ~37 empty \`msgstr\`. | \`eval/ru.po\` | ✓ |
| EVAL-3  | **Retry queue never drains.** Consumer never acks. | \`eval/retry.ts\` | ✓ |
| EVAL-4  | **Admin route missing authz check.** RBAC gate absent. | \`eval/admin-authz.ts\` | ✓ |
| EVAL-5  | **Report consumer ignores tenant prefix.** Cross-tenant leak risk. | \`eval/report.ts\` | ✓ |
| EVAL-6  | **Cache TTL too short, thrashing DB.** \`cache_miss_total\` markers. | \`eval/cache.ts\` | ✓ |
| EVAL-7  | **Legacy export path never runs.** \`exportLegacy()\` dead. | \`eval/export.ts\` | ✓ |
| EVAL-8  | **Payment webhook logs raw card token.** PCI exposure. | \`eval/payment.ts\` | ✓ |
| EVAL-9  | **Three disagreeing revenue numbers on the dashboard.** No single symbol names the bug. | narrative only, no file | ✓ |
| EVAL-10 | **Duplicate email send on retry.** Idempotency key missing in two call sites. | \`eval/notify.ts\` | ✓ |
| EVAL-12 | **53 empty Spanish translations.** | \`eval/es.po\` | ✓ |
`;

const CHECKLIST_REGISTER = `- [ ] EVAL-11 nightly ETL for the reporting mart never runs\n`;

const REGISTER_COMMIT = "aaaaaaa";
const HEAD_SHA = "bbbbbbb";

function fakeReader(filesAtRegister: Record<string, string>, filesAtHead: Record<string, string>): GitReader {
  return {
    resolveHead: () => ({ sha: HEAD_SHA, branch: "main" }),
    readFileAtRef(ref, path) {
      const table = ref === REGISTER_COMMIT ? filesAtRegister : filesAtHead;
      return table[path] ?? null;
    },
    countCommitsBetween: () => 41,
    lastCommitForPath: () => ({ sha: REGISTER_COMMIT, date: "2026-08-01" }),
    commitsTouchingSince: () => [],
    commitMeta: (sha) => ({ sha, date: "2026-08-10" }),
  };
}

const REGISTER_FILES: Record<string, string> = {
  "eval/nightly.ts": "// runNightlySync is defined but nothing calls it yet\nfunction runNightlySync() {}\n",
  "eval/ru.po": Array.from({ length: 37 }, () => 'msgstr ""').join("\n"),
  "eval/retry.ts": "// consumer loop, nothing confirms delivery\nfor (const msg of queue) { process(msg); }\n",
  "eval/admin-authz.ts": "// no rbac check present\napp.post('/admin/export', handler);\n",
  "eval/report.ts": "// ignoresTenantPrefix present, unresolved\nquery(reportSql); // ignoresTenantPrefix\n",
  "eval/cache.ts": Array.from({ length: 2 }, () => "cache_miss_total++;").join("\n"),
  "eval/export.ts": "function exportLegacy() {}\n// zero call sites\n",
  "eval/payment.ts": "logger.info(rawCardToken); // token=none-yet\n",
  "eval/notify.ts": "sendEmail(user); // no idempotency key here\n",
  "eval/es.po": Array.from({ length: 53 }, () => 'msgstr ""').join("\n"),
  "eval/nightly-etl.ts": "// dead, nothing calls runReportingEtl\n",
};

const HEAD_FILES: Record<string, string> = {
  // EVAL-1: call site now exists -> needle 0 -> 1, satisfied -> closed.
  "eval/nightly.ts": "function runNightlySync() {}\nscheduler.add(runNightlySync);\nawait runNightlySync();\n",
  // EVAL-2: 37 -> 7 empties, improved but not zero -> partial.
  "eval/ru.po": Array.from({ length: 7 }, () => 'msgstr ""').join("\n"),
  // EVAL-3: still nothing confirms delivery -> unchanged, countAtHead 0 -> open.
  "eval/retry.ts": "// consumer loop, nothing confirms delivery\nfor (const msg of queue) { process(msg); }\n",
  // EVAL-4: rbac check landed -> needle 0 -> 1, satisfied evidence, but authz keyword forces needs_human.
  "eval/admin-authz.ts": "app.post('/admin/export', requireRbac('bi:read'), handler);\n",
  // EVAL-5: ignoresTenantPrefix marker still present, unchanged, countAtHead > 0 -> contradicted.
  "eval/report.ts": "// ignoresTenantPrefix present, unresolved\nquery(reportSql); // ignoresTenantPrefix\n",
  // EVAL-6: cache_miss_total markers went UP (2 -> 5) on a decrease-goal probe -> regressed -> needs_human.
  "eval/cache.ts": Array.from({ length: 5 }, () => "cache_miss_total++;").join("\n"),
  // EVAL-7: file was rewritten, the anchor text is gone entirely -> unmeasurable -> needs_human.
  "eval/export.ts": "// legacy export path removed in the SUM-204 rewrite, replaced by exportV2()\n",
  // EVAL-8: token logging removed (satisfied), but "payment"/"token" keyword forces needs_human anyway.
  "eval/payment.ts": "logger.info('payment webhook received'); // token redacted\n",
  // EVAL-9: no file at all -- no probe can be derived from a narrative-only claim -> needs_human.
  // (no entry; readFileAtRef returns null for any path, which is fine since no probe references one)
  // EVAL-10: two probes, one closes (idempotency key added) one does not (duplicate check still missing) -> partial.
  "eval/notify.ts": "sendEmail(user, { idempotencyKey: key }); // dedupe still not enforced downstream\n",
  // EVAL-12: 53 -> 0, fully satisfied -> closed.
  "eval/es.po": "",
  // EVAL-11 (checklist register): dead code now called -> closed.
  "eval/nightly-etl.ts": "runReportingEtl();\n",
  // The register documents themselves, read at head (reconcileRegister parses
  // claims from the head revision, not the register-commit revision).
  "REGISTER.md": TABLE_REGISTER,
  "CHECKLIST.md": CHECKLIST_REGISTER,
};

export const TABLE_PROBES: Record<string, Probe[]> = {
  "EVAL-1": [{ file: "eval/nightly.ts", needle: "await runNightlySync()" }],
  "EVAL-2": [{ file: "eval/ru.po", pattern: '^msgstr ""$', goal: "decrease" }],
  "EVAL-3": [{ file: "eval/retry.ts", needle: "ack(" }],
  "EVAL-4": [{ file: "eval/admin-authz.ts", needle: "requireRbac(" }],
  "EVAL-5": [{ file: "eval/report.ts", needle: "ignoresTenantPrefix" }],
  "EVAL-6": [{ file: "eval/cache.ts", pattern: "cache_miss_total\\+\\+;", goal: "decrease" }],
  "EVAL-7": [
    {
      file: "eval/export.ts",
      pattern: "function exportLegacy",
      anchor: { start: "function exportLegacy() {}" },
    },
  ],
  "EVAL-8": [{ file: "eval/payment.ts", needle: "rawCardToken", goal: "decrease" }],
  "EVAL-9": [],
  "EVAL-10": [
    { file: "eval/notify.ts", needle: "idempotencyKey: key" },
    { file: "eval/notify.ts", needle: "dedupe enforced" },
  ],
  "EVAL-12": [{ file: "eval/es.po", pattern: '^msgstr ""$', goal: "decrease" }],
};

export const CHECKLIST_PROBES: Record<string, Probe[]> = {
  "EVAL-11": [{ file: "eval/nightly-etl.ts", needle: "runReportingEtl()" }],
};

export const SCENARIOS: EvalScenario[] = [
  { id: "EVAL-1", expectedStatus: "closed", isSecurityOrMoney: false, note: "clean fix, presence probe satisfied" },
  { id: "EVAL-2", expectedStatus: "partial", isSecurityOrMoney: false, note: "quantity improved but not to zero" },
  { id: "EVAL-3", expectedStatus: "open", isSecurityOrMoney: false, note: "untouched, no evidence either side" },
  { id: "EVAL-4", expectedStatus: "needs_human", isSecurityOrMoney: true, note: "authz fix landed but must not auto-close" },
  { id: "EVAL-5", expectedStatus: "contradicted", isSecurityOrMoney: false, note: "nothing moved, but the marker is present" },
  { id: "EVAL-6", expectedStatus: "needs_human", isSecurityOrMoney: false, note: "evidence moved the wrong way" },
  { id: "EVAL-7", expectedStatus: "needs_human", isSecurityOrMoney: false, note: "anchor text gone after a rewrite, unmeasurable" },
  { id: "EVAL-8", expectedStatus: "needs_human", isSecurityOrMoney: true, note: "payment/token fix landed but must not auto-close" },
  { id: "EVAL-9", expectedStatus: "needs_human", isSecurityOrMoney: false, note: "narrative-only claim, no probe derivable" },
  { id: "EVAL-10", expectedStatus: "partial", isSecurityOrMoney: false, note: "two probes, one closes one does not" },
  { id: "EVAL-11", expectedStatus: "closed", isSecurityOrMoney: false, note: "checklist-format register, not just markdown table" },
  { id: "EVAL-12", expectedStatus: "closed", isSecurityOrMoney: false, note: "quantity probe fully drained to zero" },
];

export function buildTableReader(): GitReader {
  return fakeReader(REGISTER_FILES, HEAD_FILES);
}

export function buildChecklistReader(): GitReader {
  return fakeReader(REGISTER_FILES, HEAD_FILES);
}

export const TABLE_REGISTER_TEXT = TABLE_REGISTER;
export const CHECKLIST_REGISTER_TEXT = CHECKLIST_REGISTER;
export const REGISTER_COMMIT_SHA = REGISTER_COMMIT;
export const HEAD_COMMIT_SHA = HEAD_SHA;
