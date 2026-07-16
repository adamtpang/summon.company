// Batch 9 (2026-07-15): market-cap scoreboard metric, desired-state reconciler,
// ICP pressure-test, and the plain-language decision rule (board feedback: cards
// are too technical to decide fast). Idempotent by exact title.

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
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const newIssues = [
  {
    title: "Market cap on the scoreboard: the company's valuation, its levers, and the current binding lever",
    priority: "high",
    ownerName: "Vitals CFO",
    description: `WHY (board, 2026-07-15): "as CEO of AI agents, I need to know my market cap."
Full model: doc/MARKET-CAP-MODEL.md (read it first - it is the spec).

SCOPE (extends VIT-70's scoreboard):
1. A Market Cap panel: current stage on the ladder (doc section 3), honest cap proxy,
   ARR from REAL Stripe data only (11x rule - $0 shows as $0), and the one binding
   lever right now (theory of constraints; pre-revenue it is "# companies > 0").
2. The levers table rendered live: # companies, employees/company, price, retention,
   gross margin, growth - each with its current real value and owner department.
3. Wire lever regressions into the CEO autopilot (VIT-71): churn event, margin
   drift, growth stall each file a starred task.
ACCEPTANCE: scoreboard shows stage + cap proxy + binding lever from real data;
faking a Stripe payment in test mode moves ARR and the panel; screenshots posted.`,
  },
  {
    title: "Desired-state company: the config is the target, the control plane is the reconciler",
    priority: "high",
    ownerName: "Vitals CTO",
    description: `WHY: Tobi Lutke's Shopify OS mechanic (doc/research/SHOPIFY-OS-DESIRED-STATE.md -
read first): declare what the company SHOULD be (config), continuously diff against
what IS, emit the minimum steps as tasks. "Think about how much politics this
removes" - every proposal shows its computed counterfactual before the board decides.

SCOPE (this names + completes what VIT-39/68/71 started):
1. The company config (goal, formation, roadmap, budgets, star fields) is formalized
   as the desired-state document per company - exportable, diffable, versioned.
2. The reconciler loop: each CEO heartbeat computes desired-vs-actual (departments
   without owners, stages without evidence, budget vs spend, quota headroom) and
   files the MINIMUM steps as tasks (dedup per VIT-71 rules).
3. Counterfactual rendering on decision cards: a hire/spend/priority proposal shows
   what it displaces ("approving this puts Engineering over budget by $X/mo" or
   "this delays VIT-41 by ~N days") computed from the config, not argued.
ACCEPTANCE: seed a config violation (remove a department owner) -> reconciler files
the fix task within one heartbeat; a seeded hire proposal renders its budget
counterfactual on the decision card; config export/import round-trips.`,
  },
  {
    title: "Pressure-test the offer and ICP: what exactly do we sell, to whom, at what price",
    priority: "high",
    ownerName: "Vitals CEO",
    description: `WHY (board, 2026-07-15): "I need to get clear on the product, service or asset I'm
selling, and who the ICP is." The board's working answer is in
doc/MARKET-CAP-MODEL.md section 4: product = AI employees ($99/mo seats in a
formation); service = the instant whole-company diagnosis (free lead magnet);
asset = the accumulated company config/context (the moat, never sold);
ICP-1 = solo technical-ish founder, 1-5 real projects, revenue intent, zero staff;
ICP-2 = SMB owner-operator (higher touch). Strangers only - never friends/family.

YOUR JOB (CEO): pressure-test this against evidence, then package ONE decision card
for the board (plain language per the decision-language rule):
1. Evidence pass: what do the landing analytics, waitlist/intake, Quantus engagement,
   and comparable products (cofounder.co, agent platforms) say about which ICP
   converts fastest?
2. Kill-test the $99 anchor: is per-employee/mo the right unit vs per-formation or
   outcome pricing at entry?
3. The decision card: "We sell X to Y at Z" with your recommendation, one-line why,
   what would change your mind, and reversibility (pricing = reversible; positioning
   = sticky). Board decides; NORTH_STAR gets updated with the ratified sentence.
NO external sends; research and packaging only.`,
  },
];

// Plain-language decision rule -> steer VIT-72 (the Decisions tab build) with the
// board's own pasted card as the before/after specimen.
const DECISION_LANGUAGE_STEER = `Board feedback (2026-07-15, BINDING for this build): decision cards are too
technical to decide fast. New rule - every decision card is written in PLAIN
LANGUAGE at the top, jargon quarantined below the fold.

CARD ANATOMY (enforce in UI + in the CEO packaging prompt):
1. QUESTION (one sentence, no codes, no file paths): "OK to build the new desktop
   layout your designer proposed?"
2. WHAT HAPPENS IF YES (one sentence): "8 build tickets start: inbox, live company
   board, sidebar, agent pages, message box, notifications, search bar, code console."
3. RECOMMENDATION + WHY (one line, from the proposer via the CEO): "Approve - it
   follows the Claude/Codex research and every panel is reversible."
4. LOOK AT (the evidence, as thumbnails not paths): the two contact-sheet images
   render INLINE on the card; never make the board open a file path.
5. REVERSIBILITY chip: reversible / costly / irreversible.
6. Below the fold (collapsed "details" section): ticket IDs, file paths, doc
   references, overlap notes - everything currently cluttering the card.

SPECIMEN - the live VIT-51 card rewritten. BEFORE: "Approve the proposed Summon
desktop information architecture and the 8-sub-issue implementation slate (A-H)...
Overlaps route to VIT-37/40/41/48 as adoption notes, not duplicates." AFTER:
"Your designer finished the desktop layout plan. OK to start building it? If yes,
8 build tickets begin (inbox, company board, sidebar, agent pages, message box,
notifications, search, code console). Recommended: approve - based on the
Claude/Codex desktop research; every panel can be changed later. [2 preview
images inline] [details v]"

Also applies to VIT-71 (CEO autopilot files tasks with plain-language titles) and
retrofits: when this ships, existing pending decisions re-render through the
formatter.`;

async function main() {
  const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  let issues = await request("GET", `/companies/${SUMMON_ID}/issues`);

  for (const spec of newIssues) {
    let issue = issues.find((c) => c.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        projectId: projects[0]?.id, goalId: goals[0]?.id,
        title: spec.title, description: spec.description,
        status: "todo", priority: spec.priority,
        assigneeAgentId: byName[spec.ownerName]?.id,
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  -> ${spec.ownerName}`);
  }

  issues = await request("GET", `/companies/${SUMMON_ID}/issues`);
  const vit72 = issues.find((c) => c.identifier === "VIT-72");
  if (vit72) {
    await request("PATCH", `/issues/${vit72.id}`, { comment: DECISION_LANGUAGE_STEER });
    console.log("steered VIT-72 with the plain-language decision rule");
  }
  console.log("\nBatch 9 applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
