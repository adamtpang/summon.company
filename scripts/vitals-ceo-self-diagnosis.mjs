// VIT-71 — CEO self-diagnosis autopilot.
//
// Reads the company vitals from the live control plane, applies dumb + legible
// anomaly rules, dedups against already-filed anomalies, and (with --file)
// files each new problem as a starred, evidenced, correctly-assigned task.
// Filing and surfacing only: no spend, no external sends.
//
// The Vitals CEO operates this on each heartbeat (see the CEO HEARTBEAT.md):
//
//   node scripts/vitals-ceo-self-diagnosis.mjs                 # dry-run report
//   node scripts/vitals-ceo-self-diagnosis.mjs --file          # file/update tasks
//   node scripts/vitals-ceo-self-diagnosis.mjs --seed=spend-spike   # acceptance seed (dry-run only)
//   node scripts/vitals-ceo-self-diagnosis.mjs --file --board-note=VIT-71  # + digest comment
//
// Auth: uses PAPERCLIP_API_KEY (Bearer) when present so mutations author as
// the running agent; unauthenticated mutations attribute to the board.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";

export const DEFAULT_CONFIG = {
  // spend pace: fire when utilization runs ahead of window elapsed time by this factor
  spendPaceTolerance: 1.25,
  // spend pace: ignore noise below this absolute spend
  spendPaceMinCents: 500,
  // revenue rule: fire when credits are zero while spend exceeds this
  revenueZeroSpendCents: 2000,
  // stalled rule: a critical task with no activity for this long is stalled
  stalledHours: 72,
  // quota rule: fire when forecast exhaustion lands within this horizon
  quotaForecastHours: 48,
  // quota rule: an exhausted window only matters if the reset is further out than this
  quotaExhaustedMinResetHours: 12,
  // dedup: do not re-comment an open anomaly issue updated more recently than this
  commentThrottleHours: 20,
};

const OPEN_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked"]);
const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
const ANOMALY_MARKER_RE = /\[vitals:([a-z0-9_.:/-]+)\]/i;

// Department owner routing by agent role. spend/pace → finance, revenue → marketing,
// quota/runtime → cto, staffing decisions → ceo.
const RULE_OWNER_ROLE = {
  spend_pace: "cfo",
  revenue_zero: "cmo",
  quota: "cto",
  dept_idle: "ceo",
};

const HOUR_MS = 3_600_000;

// --- pure helpers -----------------------------------------------------------

/** Key segments must survive the title marker round-trip: [a-z0-9_.:/-] only. */
export function keySlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function anomalyKeyFromTitle(title) {
  const match = ANOMALY_MARKER_RE.exec(String(title ?? ""));
  return match ? match[1].toLowerCase() : null;
}

export function titleWithMarker(headline, key) {
  return `${headline} [vitals:${key}]`;
}

/** Fraction (0..1) of a window elapsed at `now`; null when unbounded/invalid. */
export function windowElapsedFraction(windowStart, windowEnd, now) {
  const start = Date.parse(windowStart ?? "");
  const end = Date.parse(windowEnd ?? "");
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

/** Mirrors packages/shared quota-alerts parseWindowDurationMs for standalone use. */
export function parseWindowDurationMs(label) {
  const match = /(\d+)\s*(h|d|w)\b/i.exec(String(label ?? ""));
  if (!match) {
    const lower = String(label ?? "").toLowerCase();
    if (lower.includes("session")) return 5 * HOUR_MS;
    if (lower.includes("week")) return 7 * 86_400_000;
    if (lower.includes("month")) return 30 * 86_400_000;
    return null;
  }
  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unitMs = { h: HOUR_MS, d: 86_400_000, w: 604_800_000 }[match[2].toLowerCase()];
  return amount * unitMs;
}

/** Mirrors packages/shared quota-alerts forecastQuotaExhaustion (linear burn). */
export function forecastQuotaExhaustion({ usedPercent, resetsAt, windowDurationMs, now }) {
  if (usedPercent == null || usedPercent <= 0 || usedPercent >= 100) return null;
  if (resetsAt == null || windowDurationMs == null) return null;
  const resetMs = Date.parse(resetsAt);
  if (Number.isNaN(resetMs)) return null;
  const msUntilReset = resetMs - now.getTime();
  if (msUntilReset <= 0) return null;
  const elapsedMs = windowDurationMs - msUntilReset;
  if (elapsedMs <= 0) return null;
  const exhaustAtMs = now.getTime() + (100 - usedPercent) * (elapsedMs / usedPercent);
  if (exhaustAtMs >= resetMs) return null;
  return new Date(exhaustAtMs).toISOString();
}

function dollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function hoursAgo(iso, now) {
  return (now.getTime() - Date.parse(iso)) / HOUR_MS;
}

// --- anomaly rules ----------------------------------------------------------
//
// Each rule returns PROBLEM objects:
//   { key, rule, headline, why, evidence: string[], priority, ownerRole|ownerAgentId }
// Dumb and legible first: every firing carries the numbers that justify it.
// LLM judgment (the CEO) reviews the dry-run before filing and may adjust stars.

export function ruleSpendPace(snapshot, now, config = DEFAULT_CONFIG) {
  const problems = [];
  for (const policy of snapshot.budgets?.policies ?? []) {
    if (policy.isActive === false) continue;
    const observed = policy.observedAmount ?? 0;
    const cap = policy.amount ?? 0;
    if (cap <= 0 || observed < config.spendPaceMinCents) continue;
    const elapsed = windowElapsedFraction(policy.windowStart, policy.windowEnd, now);
    if (elapsed == null || elapsed <= 0) continue;
    const pace = observed / cap / elapsed;
    if (pace <= config.spendPaceTolerance && policy.status === "ok") continue;
    const scope = policy.scopeName ?? (policy.scopeType === "agent" ? policy.scopeId : "company");
    problems.push({
      key: `spend_pace:${keySlug(scope)}`,
      rule: "spend_pace",
      headline: `Spend pace for ${scope} is ${pace.toFixed(1)}x its budget-window pace`,
      why: `At this burn the ${scope} budget exhausts before the window resets.`,
      evidence: [
        `observed ${dollars(observed)} of ${dollars(cap)} cap (${policy.utilizationPercent ?? Math.round((observed / cap) * 100)}%)`,
        `window ${policy.windowStart} → ${policy.windowEnd}, ${(elapsed * 100).toFixed(0)}% elapsed`,
        `policy status: ${policy.status}`,
      ],
      priority: "high",
      ownerRole: RULE_OWNER_ROLE.spend_pace,
    });
  }
  return problems;
}

export function ruleRevenueZero(snapshot, now, config = DEFAULT_CONFIG) {
  const spend = snapshot.costs?.spendCents ?? 0;
  const credit = snapshot.finance?.creditCents ?? 0;
  if (credit > 0 || spend < config.revenueZeroSpendCents) return [];
  const goal = (snapshot.goals ?? []).find((g) => g.status === "active" && /\$|revenue|\/mo/i.test(g.title ?? ""));
  return [{
    key: "revenue_zero:company",
    rule: "revenue_zero",
    headline: `Revenue is ${dollars(credit)} while spend is ${dollars(spend)}`,
    why: "The company is burning without any recorded revenue against the active revenue goal.",
    evidence: [
      `finance credits ${dollars(credit)}, debits ${dollars(snapshot.finance?.debitCents ?? 0)}`,
      `agent spend ${dollars(spend)} of ${dollars(snapshot.costs?.budgetCents ?? 0)} budget`,
      goal ? `active revenue goal: "${goal.title}"` : "no active revenue goal found",
    ],
    priority: "critical",
    ownerRole: RULE_OWNER_ROLE.revenue_zero,
  }];
}

export function ruleCriticalStalled(snapshot, now, config = DEFAULT_CONFIG) {
  const problems = [];
  for (const issue of snapshot.issues ?? []) {
    if (issue.priority !== "critical" || !OPEN_STATUSES.has(issue.status)) continue;
    if (anomalyKeyFromTitle(issue.title)) continue; // never stack anomalies on anomaly tasks
    const lastActivity = issue.lastActivityAt ?? issue.updatedAt;
    const stalledFor = hoursAgo(lastActivity, now);
    if (!Number.isFinite(stalledFor) || stalledFor < config.stalledHours) continue;
    problems.push({
      key: `critical_stalled:${keySlug(issue.identifier)}`,
      rule: "critical_stalled",
      headline: `Critical task ${issue.identifier} has stalled for ${Math.floor(stalledFor)}h`,
      why: `A critical-priority task has had no activity beyond the ${config.stalledHours}h stall line.`,
      evidence: [
        `${issue.identifier} "${issue.title}" status=${issue.status}`,
        `last activity ${lastActivity} (${Math.floor(stalledFor)}h ago)`,
      ],
      priority: "critical",
      ownerAgentId: issue.assigneeAgentId ?? null,
      ownerRole: issue.assigneeAgentId ? null : "ceo",
    });
  }
  return problems;
}

export function ruleQuotaForecast(snapshot, now, config = DEFAULT_CONFIG) {
  const problems = [];
  for (const provider of snapshot.quotaWindows ?? []) {
    if (!provider.ok) continue;
    for (const window of provider.windows ?? []) {
      if (window.usedPercent == null) continue;
      const key = `quota:${keySlug(provider.provider)}:${keySlug(window.label)}`;
      const resetMs = window.resetsAt ? Date.parse(window.resetsAt) : NaN;
      const hoursToReset = Number.isNaN(resetMs) ? null : (resetMs - now.getTime()) / HOUR_MS;
      if (window.usedPercent >= 100) {
        if (hoursToReset == null || hoursToReset < config.quotaExhaustedMinResetHours) continue;
        problems.push({
          key,
          rule: "quota",
          headline: `${provider.provider} "${window.label}" quota is exhausted with ${Math.round(hoursToReset)}h until reset`,
          why: "An exhausted provider window blocks every agent on that adapter until reset.",
          evidence: [
            `usedPercent 100, resets ${window.resetsAt}`,
            `headroom now: none for ~${Math.round(hoursToReset)}h`,
          ],
          priority: "high",
          ownerRole: RULE_OWNER_ROLE.quota,
        });
        continue;
      }
      const forecast = forecastQuotaExhaustion({
        usedPercent: window.usedPercent,
        resetsAt: window.resetsAt,
        windowDurationMs: parseWindowDurationMs(window.label),
        now,
      });
      if (!forecast) continue;
      const hoursToExhaust = (Date.parse(forecast) - now.getTime()) / HOUR_MS;
      if (hoursToExhaust >= config.quotaForecastHours) continue;
      problems.push({
        key,
        rule: "quota",
        headline: `${provider.provider} "${window.label}" forecast to exhaust in ~${Math.round(hoursToExhaust)}h`,
        why: `Linear burn over the elapsed window hits 100% inside the ${config.quotaForecastHours}h horizon.`,
        evidence: [
          `usedPercent ${window.usedPercent}, resets ${window.resetsAt}`,
          `forecast exhaustion ${forecast}`,
        ],
        priority: "high",
        ownerRole: RULE_OWNER_ROLE.quota,
      });
    }
  }
  return problems;
}

export function ruleDeptIdle(snapshot, now) {
  const openByAgent = new Map();
  for (const issue of snapshot.issues ?? []) {
    if (!OPEN_STATUSES.has(issue.status) || !issue.assigneeAgentId) continue;
    openByAgent.set(issue.assigneeAgentId, (openByAgent.get(issue.assigneeAgentId) ?? 0) + 1);
  }
  const problems = [];
  for (const agent of snapshot.agents ?? []) {
    if (agent.role === "ceo") continue;
    if ((openByAgent.get(agent.id) ?? 0) > 0) continue;
    problems.push({
      key: `dept_idle:${keySlug(agent.name ?? agent.id)}`,
      rule: "dept_idle",
      headline: `${agent.name} (${agent.role}) has zero open assigned work`,
      why: "A staffed department with no active work is either an assignment gap or a deliberate pause the board should see.",
      evidence: [
        `agent status: ${agent.status}`,
        `open issues assigned: 0`,
      ],
      priority: "medium",
      ownerRole: RULE_OWNER_ROLE.dept_idle,
    });
  }
  return problems;
}

export function evaluateVitals(snapshot, now, config = DEFAULT_CONFIG) {
  return [
    ...ruleSpendPace(snapshot, now, config),
    ...ruleRevenueZero(snapshot, now, config),
    ...ruleCriticalStalled(snapshot, now, config),
    ...ruleQuotaForecast(snapshot, now, config),
    ...ruleDeptIdle(snapshot, now),
  ];
}

// --- dedup planning ---------------------------------------------------------
//
// Loop-until-dry discipline: an anomaly already open gets a comment update
// (throttled), a board-closed anomaly is recorded and never re-filed, and only
// genuinely new problems become tasks.

export function planActions(problems, issues, now, config = DEFAULT_CONFIG) {
  const byKey = new Map();
  for (const issue of issues ?? []) {
    const key = anomalyKeyFromTitle(issue.title);
    if (!key) continue;
    const existing = byKey.get(key) ?? [];
    existing.push(issue);
    byKey.set(key, existing);
  }
  return problems.map((problem) => {
    const matches = byKey.get(problem.key) ?? [];
    const open = matches.find((issue) => OPEN_STATUSES.has(issue.status));
    if (open) {
      const sinceUpdate = hoursAgo(open.updatedAt, now);
      if (sinceUpdate < config.commentThrottleHours) {
        return { action: "skip_recent", problem, issue: open,
          reason: `open as ${open.identifier}, updated ${sinceUpdate.toFixed(1)}h ago (< ${config.commentThrottleHours}h throttle)` };
      }
      return { action: "update", problem, issue: open,
        reason: `open as ${open.identifier}; posting fresh evidence` };
    }
    const closed = matches.find((issue) => TERMINAL_STATUSES.has(issue.status));
    if (closed) {
      return { action: "record_closed", problem, issue: closed,
        reason: `board closed ${closed.identifier} (${closed.status}); never re-file` };
    }
    return { action: "file", problem, issue: null, reason: "new anomaly" };
  });
}

export function problemDescription(problem, now) {
  return [
    `**Why:** ${problem.why}`,
    "",
    "**Evidence:**",
    ...problem.evidence.map((line) => `- ${line}`),
    "",
    `Filed by the CEO self-diagnosis autopilot (VIT-71) at ${now.toISOString()}.`,
    `Anomaly key: \`${problem.key}\` — keep it in the title; it is the dedup identity.`,
    "Filing and surfacing only: this task authorizes no spend and no external sends.",
  ].join("\n");
}

export function boardFeedLine(action) {
  const { problem } = action;
  if (action.action === "file") {
    return `filed [${problem.priority}] ${problem.headline}`;
  }
  if (action.action === "update") {
    return `updated ${action.issue.identifier}: ${problem.headline}`;
  }
  if (action.action === "record_closed") {
    return `recorded (board closed ${action.issue.identifier}, not re-filing): ${problem.headline}`;
  }
  return `no-op (${action.reason}): ${problem.headline}`;
}

// --- acceptance seed --------------------------------------------------------

export function applySeed(snapshot, seed, now) {
  if (seed === "spend-spike") {
    // Mock a spend spike early in the budget window: 80% of cap consumed at
    // whatever point of the month we are, with zero revenue.
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    return {
      ...snapshot,
      seeded: seed,
      costs: { ...snapshot.costs, spendCents: 8000, budgetCents: 10000, utilizationPercent: 80 },
      finance: { ...snapshot.finance, creditCents: 0 },
      budgets: {
        ...snapshot.budgets,
        policies: [
          ...(snapshot.budgets?.policies ?? []),
          {
            policyId: "seed-spend-spike", scopeType: "company", scopeName: "company (seeded)",
            metric: "billed_cents", amount: 10000, observedAmount: 8000, utilizationPercent: 80,
            status: "ok", isActive: true, windowStart, windowEnd,
          },
        ],
      },
    };
  }
  throw new Error(`Unknown seed "${seed}" (supported: spend-spike)`);
}

// --- live API ---------------------------------------------------------------

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.PAPERCLIP_API_KEY) headers.authorization = `Bearer ${process.env.PAPERCLIP_API_KEY}`;
  if (process.env.PAPERCLIP_RUN_ID) headers["x-paperclip-run-id"] = process.env.PAPERCLIP_RUN_ID;
  return headers;
}

async function api(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(body ? { "content-type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function fetchSnapshot() {
  const [costs, finance, budgets, goals, quotaWindows, issues, agents] = await Promise.all([
    api("GET", `/companies/${COMPANY_ID}/costs/summary`),
    api("GET", `/companies/${COMPANY_ID}/costs/finance-summary`),
    api("GET", `/companies/${COMPANY_ID}/budgets/overview`),
    api("GET", `/companies/${COMPANY_ID}/goals`),
    api("GET", `/companies/${COMPANY_ID}/costs/quota-windows`),
    api("GET", `/companies/${COMPANY_ID}/issues`),
    api("GET", `/companies/${COMPANY_ID}/agents`),
  ]);
  return { costs, finance, budgets, goals, quotaWindows, issues, agents };
}

function resolveOwner(problem, agents) {
  if (problem.ownerAgentId) return problem.ownerAgentId;
  const role = problem.ownerRole ?? "ceo";
  const agent = agents.find((candidate) => candidate.role === role)
    ?? agents.find((candidate) => candidate.role === "ceo");
  return agent?.id ?? null;
}

async function executeActions(actions, snapshot, now) {
  const results = [];
  for (const action of actions) {
    if (action.action === "file") {
      const { problem } = action;
      const goal = (snapshot.goals ?? []).find((g) => g.status === "active" && g.level === "team");
      const created = await api("POST", `/companies/${COMPANY_ID}/issues`, {
        title: titleWithMarker(problem.headline, problem.key),
        description: problemDescription(problem, now),
        status: "todo",
        priority: problem.priority,
        assigneeAgentId: resolveOwner(problem, snapshot.agents ?? []),
        goalId: goal?.id ?? null,
      });
      results.push({ ...action, filedIdentifier: created.identifier, filedId: created.id });
    } else if (action.action === "update") {
      const comment = await api("POST", `/issues/${action.issue.id}/comments`, {
        body: [
          `Self-diagnosis autopilot: anomaly \`${action.problem.key}\` is still firing.`,
          "",
          ...action.problem.evidence.map((line) => `- ${line}`),
        ].join("\n"),
      });
      results.push({ ...action, commentId: comment.id });
    } else {
      results.push(action);
    }
  }
  return results;
}

// --- main -------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const file = argv.includes("--file");
  const seedArg = argv.find((arg) => arg.startsWith("--seed="))?.slice("--seed=".length) ?? null;
  const boardNote = argv.find((arg) => arg.startsWith("--board-note="))?.slice("--board-note=".length) ?? null;
  if (file && seedArg) throw new Error("--seed is dry-run only: seeded evidence must never be filed as a real task");

  const now = new Date();
  let snapshot = await fetchSnapshot();
  if (seedArg) snapshot = applySeed(snapshot, seedArg, now);

  const problems = evaluateVitals(snapshot, now);
  const actions = planActions(problems, snapshot.issues, now);
  const executed = file ? await executeActions(actions, snapshot, now) : actions;

  const lines = executed.map((action) => boardFeedLine(action));
  if (file && boardNote && lines.length > 0) {
    const target = snapshot.issues.find((issue) => issue.identifier === boardNote);
    if (!target) throw new Error(`--board-note issue ${boardNote} not found`);
    await api("POST", `/issues/${target.id}/comments`, {
      body: [`CEO self-diagnosis (VIT-71) heartbeat digest:`, "", ...lines.map((line) => `- ${line}`)].join("\n"),
    });
  }

  process.stdout.write(`${JSON.stringify({
    mode: file ? "file" : "dry-run",
    seeded: snapshot.seeded ?? null,
    vitals: {
      spendCents: snapshot.costs?.spendCents ?? 0,
      budgetCents: snapshot.costs?.budgetCents ?? 0,
      revenueCents: snapshot.finance?.creditCents ?? 0,
      openIssues: snapshot.issues.filter((issue) => OPEN_STATUSES.has(issue.status)).length,
      agents: snapshot.agents.length,
      quotaProviders: (snapshot.quotaWindows ?? []).filter((provider) => provider.ok).length,
    },
    problems: problems.length,
    actions: executed.map((action) => ({
      action: action.action,
      key: action.problem.key,
      priority: action.problem.priority,
      reason: action.reason,
      issue: action.issue?.identifier ?? action.filedIdentifier ?? null,
      boardLine: boardFeedLine(action),
    })),
  }, null, 2)}\n`);
}

const isMain = process.argv[1]
  && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
