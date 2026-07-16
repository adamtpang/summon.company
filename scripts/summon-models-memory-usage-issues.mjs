// Files the model-modularity/memory/usage/fallback product bets as staged issues
// (unassigned; assigning wakes the agent). 2026-07-15 evening batch.
// Grounded in: today's Codex quota exhaustion (proof of need), existing UI surfaces
// (ClaudeSubscriptionPanel/CodexSubscriptionPanel/ProviderQuotaCard/QuotaBar/Costs),
// VIT-37 (model picker), VIT-46 (cost ledger), OPENCLAW-LEARNINGS.md sections 2.4/2.6.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function request(method, path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const issues = [
  {
    title: "Per-employee memory: MEMORY.md files + pre-compaction flush (memories that survive resets)",
    priority: "high",
    proposedOwner: "Vitals Engineer",
    description: `WHY: Each AI employee should have its OWN durable memory as plain markdown files -
"the model only remembers what gets saved to disk; there is no hidden state"
(doc/research/OPENCLAW-LEARNINGS.md section 2.6). Today agents have instruction
bundles (AGENTS.md) but no writable memory: nothing implemented server-side
(verified: no MEMORY.md/memoryFile handling in server/ or packages/).

SOLUTION (additive; pairs with VIT-40 conversation continuity):
1. Memory hierarchy per company workspace: COMPANY.md (shared institutional memory),
   per-employee MEMORY.md + dated run notes (memory/<agent>/2026-07-15.md).
2. Adapter hook: load the employee's memory files at session start alongside the
   instruction bundle; on any context compaction or session end, force a
   persist-to-memory turn (the OpenClaw pre-compaction flush) so learnings are
   written BEFORE they are lost.
3. Memory is versioned with the workspace repo (git) so the board can read, diff,
   and correct what an employee believes. UI: a Memory tab on AgentDetail rendering
   the files read-only with an edit affordance for the board.

ACCEPTANCE: an employee told a durable fact in one run recalls it in a fresh run
after restart (test); compaction demonstrably triggers a memory write; the board can
view + edit MEMORY.md from AgentDetail; memory files ride the workspace repo.`,
  },
  {
    title: "Usage monitor: live Claude + Codex quota dashboard with limit alerts and forecasts",
    priority: "high",
    proposedOwner: "Vitals Engineer",
    description: `WHY: Today (2026-07-15) the Codex subscription silently hit its usage limit and
EVERY codex_local agent errored until Jul 22 - the board found out from error states,
not from a warning. Panels already exist (ClaudeSubscriptionPanel,
CodexSubscriptionPanel with 5h/weekly QuotaWindows, ProviderQuotaCard, QuotaBar,
Costs page) but they are passive readouts.

SOLUTION (additive, builds on the existing panels + VIT-46 cost ledger):
1. One Usage home surfacing ALL providers side by side: current window consumption,
   window reset times, per-employee attribution (who is burning the quota), trend
   sparkline per window.
2. Threshold alerts as board notifications: warn at 70%, urgent at 90%, and a
   pre-exhaustion forecast ("at current burn, weekly limit hits Thursday ~14:00").
   Alert lands in the board feed AND as a desktop notification.
3. At the wall: instead of agents dying into error state, the run is suspended with
   a clear "quota exhausted until <reset>" state (distinct from error) and the
   fallback policy (see fallback-models issue) is consulted first.
4. Menu/tray affordance: a tiny quota meter for at-a-glance health.

ACCEPTANCE: simulate 90% consumption -> board notification fires; exhaust a quota ->
agents show "quota-suspended (resets <t>)" not "error"; Usage home shows both
providers with per-employee attribution; evidence screenshots light+dark.`,
  },
  {
    title: "Fallback model chains: auto-failover when a provider runs out (per-employee, board-notified)",
    priority: "high",
    proposedOwner: "Vitals Engineer (policy engine w/ CTO for adapter layer)",
    description: `WHY: When Codex exhausted today, five agents went dark for a WEEK. The fix that
kept work moving was a manual adapter flip (Design Director -> claude_local). That
should be policy, not surgery. OpenClaw's model config is "provider/model strings
with ordered fallbacks and auto-reprobe of the primary"
(doc/research/OPENCLAW-LEARNINGS.md section 2.4).

SOLUTION (extends VIT-37 model picker + the runtimeConfig model profiles):
1. Per-employee ORDERED model chain: primary -> fallback1 -> fallback2 (e.g.
   codex_local/gpt-5.5 -> claude_local/fable-5 -> claude_local/haiku cheap profile).
   Chain editable in the model picker UI; company-level default chain.
2. Failover triggers: quota exhaustion, auth failure, provider outage, and
   cost_limit-remaining too low for the run. NOT for content refusals (those need
   the board, not a different model).
3. Auto-reprobe: periodically retest the primary; when it recovers (e.g. quota
   window resets), fall back UP automatically.
4. Governance: every failover writes an event + board notification ("Engineer fell
   back to Claude: Codex weekly limit until Jul 22"); the board can pin an employee
   to a single provider (no-fallback flag) for sensitive work.

ACCEPTANCE: with the primary's quota exhausted (or mocked exhausted), a new run
transparently executes on fallback1 with the failover event logged + notified;
primary recovery flips the next run back; the chain editor persists per employee;
pinned employees never fail over. Today's incident is the regression test.`,
  },
];

async function main() {
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  const goalId = goals[0]?.id;
  const projectId = projects[0]?.id;

  for (const spec of issues) {
    const existing = await request("GET", `/companies/${SUMMON_ID}/issues`);
    let issue = existing.find((c) => c.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        ...(projectId ? { projectId } : {}),
        ...(goalId ? { goalId } : {}),
        title: spec.title,
        description: spec.description,
        status: "todo",
        priority: spec.priority,
        // staged unassigned - board assigns to start
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  ${spec.title}`);
    console.log(`   proposed owner: ${spec.proposedOwner}`);
  }
  console.log("\n3 issues staged (unassigned).");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
