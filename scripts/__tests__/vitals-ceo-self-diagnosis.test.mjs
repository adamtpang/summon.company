import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONFIG,
  anomalyKeyFromTitle,
  applySeed,
  boardFeedLine,
  evaluateVitals,
  forecastQuotaExhaustion,
  parseWindowDurationMs,
  planActions,
  ruleCriticalStalled,
  ruleDeptIdle,
  ruleQuotaForecast,
  ruleRevenueZero,
  ruleSpendPace,
  titleWithMarker,
  windowElapsedFraction,
} from "../vitals-ceo-self-diagnosis.mjs";

const NOW = new Date("2026-07-16T12:00:00.000Z");

function emptySnapshot() {
  return {
    costs: { spendCents: 0, budgetCents: 10000, utilizationPercent: 0 },
    finance: { debitCents: 0, creditCents: 0 },
    budgets: { policies: [] },
    goals: [],
    quotaWindows: [],
    issues: [],
    agents: [],
  };
}

test("anomaly key marker round-trips through the title", () => {
  const title = titleWithMarker("Spend pace is 3.0x", "spend_pace:company");
  assert.equal(anomalyKeyFromTitle(title), "spend_pace:company");
  assert.equal(anomalyKeyFromTitle("plain title"), null);
});

test("spend pace fires when utilization runs ahead of the window", () => {
  const snapshot = emptySnapshot();
  snapshot.budgets.policies = [{
    scopeType: "company", scopeName: "company", amount: 10000, observedAmount: 8000,
    utilizationPercent: 80, status: "ok", isActive: true,
    windowStart: "2026-07-01T00:00:00.000Z", windowEnd: "2026-08-01T00:00:00.000Z",
  }];
  // 80% spent at exactly 50% elapsed → pace 1.6x > 1.25 tolerance
  const problems = ruleSpendPace(snapshot, NOW);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].key, "spend_pace:company");
  assert.equal(problems[0].ownerRole, "cfo");
  assert.ok(problems[0].evidence.some((line) => line.includes("$80.00")));
});

test("spend pace stays quiet when spend tracks the window", () => {
  const snapshot = emptySnapshot();
  snapshot.budgets.policies = [{
    scopeType: "company", scopeName: "company", amount: 10000, observedAmount: 5000,
    utilizationPercent: 50, status: "ok", isActive: true,
    windowStart: "2026-07-01T00:00:00.000Z", windowEnd: "2026-08-01T00:00:00.000Z",
  }];
  assert.equal(ruleSpendPace(snapshot, NOW).length, 0);
});

test("spend pace ignores sub-noise spend", () => {
  const snapshot = emptySnapshot();
  snapshot.budgets.policies = [{
    scopeType: "agent", scopeName: "Vitals CFO", amount: 5000, observedAmount: 400,
    status: "ok", isActive: true,
    windowStart: "2026-07-15T00:00:00.000Z", windowEnd: "2026-08-15T00:00:00.000Z",
  }];
  assert.equal(ruleSpendPace(snapshot, NOW).length, 0);
});

test("revenue-zero fires only past the spend threshold", () => {
  const quiet = emptySnapshot();
  quiet.costs.spendCents = 1999;
  assert.equal(ruleRevenueZero(quiet, NOW).length, 0);

  const firing = emptySnapshot();
  firing.costs.spendCents = 2000;
  firing.goals = [{ status: "active", title: "Reach $3,000+/mo by July 31" }];
  const problems = ruleRevenueZero(firing, NOW);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].priority, "critical");
  assert.equal(problems[0].ownerRole, "cmo");
  assert.ok(problems[0].evidence.some((line) => line.includes("$3,000+/mo")));

  const paying = emptySnapshot();
  paying.costs.spendCents = 9000;
  paying.finance.creditCents = 100;
  assert.equal(ruleRevenueZero(paying, NOW).length, 0);
});

test("critical stalled fires at the 72h line and skips anomaly tasks", () => {
  const snapshot = emptySnapshot();
  snapshot.issues = [
    { identifier: "VIT-1", title: "fresh", priority: "critical", status: "in_progress",
      updatedAt: "2026-07-15T12:00:00.000Z", assigneeAgentId: "a1" },
    { identifier: "VIT-2", title: "stalled", priority: "critical", status: "in_progress",
      updatedAt: "2026-07-13T11:00:00.000Z", assigneeAgentId: "a2" },
    { identifier: "VIT-3", title: "stalled but high", priority: "high", status: "todo",
      updatedAt: "2026-07-01T00:00:00.000Z", assigneeAgentId: "a3" },
    { identifier: "VIT-4", title: titleWithMarker("old anomaly", "dept_idle:x"), priority: "critical",
      status: "todo", updatedAt: "2026-07-01T00:00:00.000Z", assigneeAgentId: "a4" },
  ];
  const problems = ruleCriticalStalled(snapshot, NOW);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].key, "critical_stalled:vit-2");
  assert.equal(problems[0].ownerAgentId, "a2");
});

test("critical stalled prefers lastActivityAt over updatedAt", () => {
  const snapshot = emptySnapshot();
  snapshot.issues = [
    { identifier: "VIT-9", title: "active run", priority: "critical", status: "in_progress",
      updatedAt: "2026-07-10T00:00:00.000Z", lastActivityAt: "2026-07-16T10:00:00.000Z" },
  ];
  assert.equal(ruleCriticalStalled(snapshot, NOW).length, 0);
});

test("quota window duration parses labels and falls back to named windows", () => {
  assert.equal(parseWindowDurationMs("5h limit"), 5 * 3_600_000);
  assert.equal(parseWindowDurationMs("Current week (all models)"), 7 * 86_400_000);
  assert.equal(parseWindowDurationMs("Current session"), 5 * 3_600_000);
  assert.equal(parseWindowDurationMs("Credits"), null);
});

test("quota forecast mirrors linear burn and respects the reset wall", () => {
  // 60% used, 2.5h into a 5h window → exhausts in ~1.7h, before the reset.
  const forecast = forecastQuotaExhaustion({
    usedPercent: 60,
    resetsAt: new Date(NOW.getTime() + 2.5 * 3_600_000).toISOString(),
    windowDurationMs: 5 * 3_600_000,
    now: NOW,
  });
  assert.ok(forecast);
  // Steady burn that exhausts exactly at the reset is not a wall → null.
  assert.equal(forecastQuotaExhaustion({
    usedPercent: 50,
    resetsAt: new Date(NOW.getTime() + 2.5 * 3_600_000).toISOString(),
    windowDurationMs: 5 * 3_600_000,
    now: NOW,
  }), null);
  // Slow burn that resets before exhaustion → no forecast.
  assert.equal(forecastQuotaExhaustion({
    usedPercent: 10,
    resetsAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    windowDurationMs: 5 * 3_600_000,
    now: NOW,
  }), null);
});

test("quota rule flags exhausted windows with a far reset and near-term forecasts", () => {
  const snapshot = emptySnapshot();
  snapshot.quotaWindows = [
    { provider: "openai", ok: true, windows: [
      { label: "5h limit", usedPercent: 100, resetsAt: new Date(NOW.getTime() + 120 * 3_600_000).toISOString() },
      { label: "Credits", usedPercent: null, resetsAt: null },
    ] },
    { provider: "anthropic", ok: true, windows: [
      // 95% used, 90% through a week window → forecast lands within 48h and before reset
      { label: "Current week (all models)", usedPercent: 95,
        resetsAt: new Date(NOW.getTime() + 0.1 * 7 * 86_400_000).toISOString() },
    ] },
    { provider: "broken", ok: false, windows: [{ label: "5h", usedPercent: 100, resetsAt: null }] },
  ];
  const problems = ruleQuotaForecast(snapshot, NOW);
  assert.equal(problems.length, 2);
  assert.ok(problems.every((problem) => problem.ownerRole === "cto"));
  const exhausted = problems.find((problem) => problem.key === "quota:openai:5h-limit");
  assert.ok(exhausted.headline.includes("exhausted"));
});

test("quota rule ignores exhausted windows about to reset anyway", () => {
  const snapshot = emptySnapshot();
  snapshot.quotaWindows = [
    { provider: "openai", ok: true, windows: [
      { label: "5h limit", usedPercent: 100, resetsAt: new Date(NOW.getTime() + 3_600_000).toISOString() },
    ] },
  ];
  assert.equal(ruleQuotaForecast(snapshot, NOW).length, 0);
});

test("dept idle flags non-CEO agents with zero open work", () => {
  const snapshot = emptySnapshot();
  snapshot.agents = [
    { id: "ceo-1", name: "Vitals CEO", role: "ceo", status: "running" },
    { id: "cto-1", name: "Vitals CTO", role: "cto", status: "running" },
    { id: "cfo-1", name: "Vitals CFO", role: "cfo", status: "idle" },
  ];
  snapshot.issues = [
    { status: "in_progress", assigneeAgentId: "cto-1", title: "x", priority: "high", updatedAt: NOW.toISOString(), identifier: "VIT-5" },
    { status: "done", assigneeAgentId: "cfo-1", title: "y", priority: "high", updatedAt: NOW.toISOString(), identifier: "VIT-6" },
  ];
  const problems = ruleDeptIdle(snapshot, NOW);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].key, "dept_idle:vitals-cfo");
  assert.equal(problems[0].ownerRole, "ceo");
});

test("dedup: open anomaly gets an update, throttled when recently touched", () => {
  const problem = { key: "quota:openai:5h-limit", rule: "quota", headline: "h", why: "w",
    evidence: ["e"], priority: "high", ownerRole: "cto" };
  const openStale = [{ identifier: "VIT-80", title: titleWithMarker("h", problem.key),
    status: "todo", updatedAt: "2026-07-14T00:00:00.000Z" }];
  assert.equal(planActions([problem], openStale, NOW)[0].action, "update");

  const openFresh = [{ identifier: "VIT-80", title: titleWithMarker("h", problem.key),
    status: "todo", updatedAt: "2026-07-16T06:00:00.000Z" }];
  assert.equal(planActions([problem], openFresh, NOW)[0].action, "skip_recent");
});

test("dedup: board-closed anomaly is recorded, never re-filed", () => {
  const problem = { key: "dept_idle:vitals-coo", rule: "dept_idle", headline: "h", why: "w",
    evidence: ["e"], priority: "medium", ownerRole: "ceo" };
  const closed = [{ identifier: "VIT-81", title: titleWithMarker("h", problem.key),
    status: "cancelled", updatedAt: "2026-07-10T00:00:00.000Z" }];
  const [action] = planActions([problem], closed, NOW);
  assert.equal(action.action, "record_closed");
  assert.ok(boardFeedLine(action).includes("not re-filing"));
});

test("dedup: new anomaly files, and an open match beats a closed match", () => {
  const problem = { key: "spend_pace:company", rule: "spend_pace", headline: "h", why: "w",
    evidence: ["e"], priority: "high", ownerRole: "cfo" };
  assert.equal(planActions([problem], [], NOW)[0].action, "file");
  const both = [
    { identifier: "VIT-90", title: titleWithMarker("h", problem.key), status: "done", updatedAt: "2026-07-01T00:00:00.000Z" },
    { identifier: "VIT-91", title: titleWithMarker("h", problem.key), status: "blocked", updatedAt: "2026-07-01T00:00:00.000Z" },
  ];
  const [action] = planActions([problem], both, NOW);
  assert.equal(action.action, "update");
  assert.equal(action.issue.identifier, "VIT-91");
});

test("seeded spend spike produces the acceptance anomaly end to end", () => {
  const snapshot = applySeed(emptySnapshot(), "spend-spike", NOW);
  assert.equal(snapshot.seeded, "spend-spike");
  const problems = evaluateVitals(snapshot, NOW);
  const keys = problems.map((problem) => problem.key);
  assert.ok(keys.includes("spend_pace:company-seeded"));
  assert.ok(keys.includes("revenue_zero:company"));
  const actions = planActions(problems, snapshot.issues, NOW);
  assert.ok(actions.every((action) => action.action === "file"));
});

test("windowElapsedFraction clamps and rejects invalid windows", () => {
  assert.equal(windowElapsedFraction("2026-07-01T00:00:00Z", "2026-08-01T00:00:00Z", new Date("2026-06-01T00:00:00Z")), 0);
  assert.equal(windowElapsedFraction("2026-07-01T00:00:00Z", "2026-08-01T00:00:00Z", new Date("2026-09-01T00:00:00Z")), 1);
  assert.equal(windowElapsedFraction(null, "2026-08-01T00:00:00Z", NOW), null);
  assert.equal(windowElapsedFraction("2026-08-01T00:00:00Z", "2026-07-01T00:00:00Z", NOW), null);
});
