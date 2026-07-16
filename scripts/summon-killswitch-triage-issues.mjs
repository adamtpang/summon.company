// Batch 13 (2026-07-16): fleet kill switch UI + CEO triage skill (Thiel S-tier-only
// doctrine). Staged UNASSIGNED — intentional mode: the board points agents deliberately.
// Idempotent by exact title.

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
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 250)}`);
  return data;
}

const issues = [
  {
    title: "Fleet kill switch: see every running agent, stop any or all, in one glance",
    priority: "critical",
    proposedOwner: "Vitals Engineer (board assigns deliberately)",
    description: `WHY (board, 2026-07-16): "I want this option to clearly see all my running agents
and to stop them from running." Today a full stop took API scripts and three sweeps
because cancel drains a hidden wake queue one run at a time. The board must never
need a script to regain control of its own company.

SCOPE (additive; extends VIT-112's live-runs zone):
1. RUNNING NOW panel (Mission Control zone + tray flyout): every active/queued run
   across ALL companies - agent, company, task one-liner, elapsed time, est. tokens.
2. Controls: per-run Stop; per-agent Pause; company STOP ALL; fleet STOP EVERYTHING
   (cancels active runs AND the queued wake backlog atomically - the three-sweep
   problem must be one click).
3. Stopped-state clarity: a stopped run shows who stopped it and why-optional;
   paused agents show "paused by board" with one-click resume.
4. Usage guardrail tie-in (VIT-48/49): the panel shows current session/window burn
   next to the fleet so stop decisions are informed.
ACCEPTANCE: from a cold app open, board reaches STOP EVERYTHING in <=2 interactions;
clicking it leaves zero active + zero queued runs (verified against the API);
per-run stop works mid-stream; light+dark screenshots posted.`,
  },
  {
    title: "CEO triage skill: surface -> triage -> board picks -> point ONE agent (Thiel S-tier-only doctrine)",
    priority: "critical",
    proposedOwner: "Vitals CEO operates it; CTO wires the skill (board assigns deliberately)",
    description: `WHY (board, 2026-07-16): "the CEO should have a triage/prioritize skill so we can
surface problems, triage them, THEN be super intentional where to point the right AI
agent. S-tier tasks only, just like Peter Thiel's management philosophy" - at PayPal
Thiel gave every person exactly ONE thing; they were evaluated on that alone and he
would discuss nothing else. Summon's version: an agent holds AT MOST ONE S-tier task
or holds NOTHING.

THE SKILL (a company SKILL.md the CEO runs ON DEMAND - no heartbeat, never auto-fires):
1. SENSE: read live goals, tasks, budgets, quota headroom, run history, roadmap
   stages, customer evidence (the standard's sense step, run once, on invocation).
2. SURFACE: list candidate problems with evidence - each one line, plain language.
3. TRIAGE: rank by Summon Score (VIT-113) + the Thiel test ("is this the single most
   important thing its department could do? would the board discuss anything else
   with that agent?"). Everything failing the test is BACKLOG, never assigned.
4. PRESENT: one plain-language decision card to the board: the S-tier shortlist
   (max 3), the recommended ONE-per-department pointing, cost estimate (est. tokens/
   session burn), and what is deliberately NOT being done.
5. DISPATCH only after the board picks: resume exactly the chosen agent(s), assign
   exactly one S-tier task each, with acceptance criteria + budget + wake condition.
   Everything else stays paused.
GUARDRAILS: skill never wakes anyone by itself; max one concurrent CEO run; the
whole triage costs one bounded run (cheap profile for sensing, strong for ranking).
DOCTRINE CHANGE this encodes: the standard's "30-minute heartbeat safety net" is
retired in favor of board-invoked triage (update VITALS_COMPANY_STANDARD.md's CEO
loop section in the same change).
ACCEPTANCE: board runs the skill from the CEO chat thread; gets the decision card;
picks; exactly the chosen agents resume with exactly one S-tier task each; total
skill cost visible; a second invocation with unchanged evidence produces "no new
S-tier - constraint unchanged" not duplicates.`,
  },
];

async function main() {
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  const existing = await request("GET", `/companies/${SUMMON_ID}/issues`);
  for (const spec of issues) {
    let issue = existing.find((c) => c.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        projectId: projects[0]?.id, goalId: goals[0]?.id,
        title: spec.title, description: spec.description,
        status: "todo", priority: spec.priority,
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  staged unassigned (proposed: ${spec.proposedOwner})`);
  }
  console.log("\nBatch 13 staged. Nothing woken.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
