// Batch 14 (2026-07-16): Manual/24-7 mode toggle + CEO three-skill decomposition
// (Surface/Triage/Route + human Assign + ETAs) + core-8 for imported companies.
// All staged UNASSIGNED (intentional mode). Idempotent by exact title.

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

const NEW_ISSUES = [
  {
    title: "Operating modes: Manual (CEO runs the ship) <-> 24/7 (overnight autonomy, token-shrewd)",
    priority: "critical",
    description: `WHY (board, 2026-07-16): "a manual mode where I manually run the ship as the CEO,
and another mode I can toggle - 24/7 mode - where I leave Summon and the agents to
run the company overnight, super intentional and shrewd about token usage."

SOLUTION - one company-level toggle, visible in Mission Control + tray:
1. MANUAL MODE (default): every agent paused unless the board points it; zero
   heartbeats; comment-wakes queue but DO NOT execute (they surface as "waiting for
   manual dispatch"); the only runs are board-dispatched, one S-tier per agent.
2. 24/7 MODE: heartbeats + queued wakes execute - inside a TOKEN GOVERNOR:
   - a session/overnight budget the board sets when flipping the toggle ("run until
     6am or N-tokens/$X, whichever first");
   - cheap-profile default for sensing/routine work, strong models only on S-tier
     execution (existing modelProfiles machinery);
   - S-tier-only dispatch (the Thiel rule holds even unattended);
   - provider-window awareness (VIT-48/49): if the 5h window would exhaust before
     reset, the governor throttles instead of erroring;
   - hard floor: never touch the board's reserved headroom (configurable %) so the
     morning Claude Code session is never starved.
3. MORNING REPORT: flipping back to Manual (or the budget expiring) produces one
   plain-language digest: what ran, what it cost, what shipped w/ evidence links,
   what is waiting for the board (the idle-tycoon "while you were gone" recap from
   BEST-DASHBOARDS.md, honest edition).
4. The toggle writes an audit event; mode is per-company; Quantus can be Manual
   while Summon runs 24/7.
ACCEPTANCE: flipping to Manual instantly quiesces (zero executing wakes - the
VIT-125 stop machinery); flipping to 24/7 with a $2 budget runs overnight and stops
AT the budget with the morning report; provider-window throttling observable in a
seeded test; mode visible at all times in Mission Control + tray.`,
  },
];

const STEERS = {
  "VIT-126": `Board refinement (2026-07-16, supersedes the single-skill framing): the CEO has
THREE named skills, run in order, each producing a visible artifact - then the HUMAN
does the assign.

1. SURFACE - scan the company for problems and limiting factors: spend pace vs cap,
   revenue vs target, stalled tasks, quota headroom, roadmap stage gaps, churn/user
   signals. Output: a plain-language problem list, each with evidence numbers and
   the LIMITING FACTOR chain (not "revenue low" but "revenue low <- no outreach
   sent <- no prospect list <- Sales has no S-tier task").
2. TRIAGE - rank every surfaced problem + open ticket by the Summon Score variables
   (importance, urgency, time impact, money impact; VIT-113 fields). Output: the
   prioritized board, S-tier line drawn (Thiel test), everything below the line
   explicitly parked.
3. ROUTE - tag each S-tier item with the RIGHT agent archetype (core-8 department +
   persona fit + current availability + provider window headroom) and an ETA
   ESTIMATE: time-to-first-response and time-to-evidence, derived from that agent's
   run history (honest: show the historical median, not a promise).
THEN THE BOARD ASSIGNS: the CEO presents one decision card (shortlist, routing tags,
ETAs, est. token cost); the human CEO picks and hires/resumes exactly the chosen
agents - one S-tier task each. The skills NEVER auto-dispatch in Manual mode; in
24/7 mode (see operating-modes ticket) Route may auto-assign within the token
governor, logging every assignment for the morning report.
ETAs also render in chat: when the board messages a paused/busy employee, the thread
shows "expected response: ~Xm (based on last 10 runs)".`,
  "VIT-114": `Board extension (2026-07-16): core-8 + roadmap seeding applies to EVERY company -
newly created AND imported/existing ones being improved. Import flow (VIT-33/60)
seeds the same eight department proposals + 8-stage roadmap instantiated against
what the diagnosis found (an existing business may enter at stage 5-7; the roadmap
shows completed stages as done, not empty). After seeding, the user can customize:
rename agents, add MORE agents beyond the core 8 (board-approved hires), assign
personas. The core 8 is the floor, never the ceiling.`,
};

async function main() {
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  let issues = await request("GET", `/companies/${SUMMON_ID}/issues`);

  for (const spec of NEW_ISSUES) {
    let issue = issues.find((c) => c.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        projectId: projects[0]?.id, goalId: goals[0]?.id,
        title: spec.title, description: spec.description,
        status: "todo", priority: spec.priority,
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  staged unassigned`);
  }

  issues = await request("GET", `/companies/${SUMMON_ID}/issues`);
  for (const [identifier, comment] of Object.entries(STEERS)) {
    const issue = issues.find((c) => c.identifier === identifier);
    if (!issue) { console.log(`${identifier} missing`); continue; }
    await request("PATCH", `/issues/${issue.id}`, { comment });
    console.log(`steered ${identifier} (unassigned/paused owner - no wake executes in current state)`);
  }
  console.log("\nBatch 14 staged.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
