/**
 * Eval suite for the register-truth reconciler: 12 synthetic findings with
 * known ground truth, run through the real reconcileRegister() pipeline
 * (not classify() in isolation, which register-truth.test.ts already
 * covers). This is the number cited as proof the reconciler works, not just
 * that it was built: see server/src/services/register-truth-eval-scenarios.ts
 * for how each scenario's ground truth was constructed.
 */
import { describe, expect, it } from "vitest";

import { reconcileRegister } from "../services/register-truth.js";
import {
  SCENARIOS,
  TABLE_PROBES,
  CHECKLIST_PROBES,
  buildTableReader,
  buildChecklistReader,
} from "../services/register-truth-eval-scenarios.js";

const tableReceipt = reconcileRegister({
  repoDir: "/fake",
  repo: "eval/synthetic",
  registerPath: "REGISTER.md",
  reader: buildTableReader(),
  overrides: TABLE_PROBES,
});

const checklistReceipt = reconcileRegister({
  repoDir: "/fake",
  repo: "eval/synthetic",
  registerPath: "CHECKLIST.md",
  reader: buildChecklistReader(),
  overrides: CHECKLIST_PROBES,
});

function actualStatusFor(id: string): string | undefined {
  return (
    tableReceipt.findings.find((f) => f.id === id)?.actualStatus ??
    checklistReceipt.findings.find((f) => f.id === id)?.actualStatus
  );
}

describe("register-truth eval suite", () => {
  it.each(SCENARIOS)("$id: $note -> $expectedStatus", (scenario) => {
    expect(actualStatusFor(scenario.id)).toBe(scenario.expectedStatus);
  });

  it("classifies every synthetic scenario correctly", () => {
    const results = SCENARIOS.map((s) => ({
      id: s.id,
      expected: s.expectedStatus,
      actual: actualStatusFor(s.id),
      correct: actualStatusFor(s.id) === s.expectedStatus,
    }));
    const correct = results.filter((r) => r.correct).length;
    expect({ correct, total: results.length }).toEqual({ correct: SCENARIOS.length, total: SCENARIOS.length });
  });

  it("never auto-closes a security or payment finding, even with fully satisfied evidence", () => {
    const securityFindings = SCENARIOS.filter((s) => s.isSecurityOrMoney);
    expect(securityFindings.length).toBeGreaterThan(0);
    for (const s of securityFindings) {
      expect(actualStatusFor(s.id)).not.toBe("closed");
    }
  });

  it("resolves all five FindingStatus values across the suite, not just the easy ones", () => {
    const seen = new Set(SCENARIOS.map((s) => s.expectedStatus));
    expect(seen).toEqual(new Set(["closed", "partial", "open", "needs_human", "contradicted"]));
  });
});
