// Batch 10 (2026-07-16): the three-surface simplification. Mission Control (master
// gamified dashboard), the Summon Score (one prioritization number), core-8 default
// seeding, and the VIT-51 simplification steer. Idempotent by exact title.

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
    title: "Mission Control: the one-screen gamified master dashboard (vitals + formation + roadmap + task queue)",
    priority: "critical",
    ownerName: "Vitals Design Director",
    description: `WHY (board, 2026-07-16): "the desktop GUI needs to be MUCH more simplified - it's
quite complex. I want the master gamified dashboard with key company vitals and stats
and roadmap and org chart and prioritized task list." The app collapses to THREE
SURFACES: Chat (VIT-41/57), Mission Control (this), Decisions (VIT-72). Everything
else is one click deep or deleted (Elon gate 2: try very hard to delete).

RESEARCH SOURCE (read first when it lands): doc/research/BEST-DASHBOARDS.md - the
best software dashboards + management-game HUDs of all time (Football Manager squad
screen, SimCity vitals, Civ tech tree, Stripe hero-number discipline, Tufte
data-ink), synthesized into a one-screen layout proposal with enforceable simplicity
gates. Also: doc/research/MOBBIN-PATTERNS.md + DESKTOP-UX-SKELETONS.md (yours).

THE ONE SCREEN (named zones, all real data - 11x rule):
1. VITALS STRIP (top): the EKG scoreboard - revenue, tasks shipped, time/money saved,
   streak; market cap panel (VIT-101) with current stage + binding lever.
2. FORMATION (org chart): the 8 departments as the FIFA/Football-Manager formation -
   employee card per department: status dot, current task one-liner, persona badge.
   Click = that employee's chat thread.
3. ROADMAP: the 8 stages as progress bars, current constraint highlighted (VIT-13
   mechanics, compressed to one row of bars).
4. TASK QUEUE: top 5-7 tasks sorted by the Summon Score (see companion ticket) with
   stars, owner avatar, progress bar - "the table is the map, chat is the territory";
   row click = task thread. Full list one click deep.
5. DECISIONS BADGE: count + one-key entry to the Decisions tab. Never a second inbox.
GATES: daily-action test (if the board doesn't act on it daily it is NOT on this
screen); max 7 top-level zones; progressive disclosure everywhere; no metric the
runtime logs can't prove; no decorative XP or fake urgency.
ACCEPTANCE: one screen shows a stranger the whole company state in 10 seconds;
every current standalone surface it absorbs is either reachable one click deep or
recorded as DELETED in DECISION-SHEET; contact sheet (light+dark) for board gallery
BEFORE build; Company Zero and Quantus both render it with real data.`,
  },
  {
    title: "The Summon Score: one number that orders every task (money, time, importance, urgency, effort, humans)",
    priority: "critical",
    ownerName: "Vitals Engineer",
    description: `WHY (board, 2026-07-16): "task list prioritized by time money importance urgency
quantity of humans and quality etc, some kind of prioritization method." One legible
formula, computed and sortable everywhere (Mission Control queue, scoreboard,
CEO packaging).

THE FORMULA (weighted-shortest-job-first adapted; all inputs 0-5 integers):
  Summon Score = (money + time + importance) x urgency / max(1, effort x humans)
- money: $ impact if done (revenue grown or cost saved)
- time: hours the board/company gets back
- importance: the existing importanceStars (VIT-70)
- urgency: the existing urgencyStars (deadline pressure)
- effort: agent-hours to ship (job size)
- humans: board attention required (0 = fully delegable, 5 = board-heavy)
- QUALITY is NOT a score input - it is the acceptance gate (evidence or not done).
Higher score = do first: cheap, urgent, high-impact, delegable work rises; expensive
board-heavy work sinks unless its impact justifies it.

SCOPE: (1) additive fields moneyStars/timeStars/effortStars/humanStars alongside the
VIT-70 star fields; (2) score computed server-side, shown as one number with a hover
breakdown; (3) default sort of the Mission Control queue + task list; (4) agents
PROPOSE star values with one-line reasons when filing; board edits inline (VIT-70
mechanics); (5) weights configurable per company in the config (desired-state file,
VIT-102) - the formula is a default, not a dogma.
ACCEPTANCE: every open task carries a score with visible breakdown; re-starring
reorders live; the CEO autopilot files tasks with proposed stars; formula documented
in VITALS_COMPANY_STANDARD.md.`,
  },
  {
    title: "Core-8 by default: every new company starts with the eight-department formation",
    priority: "high",
    ownerName: "Vitals COO",
    description: `WHY (board, 2026-07-16): "every org should start with the core 8 departments/
employees." Standardization (VIT-39/60) made the checklist; this makes the FORMATION
the default at birth.

SCOPE: (1) company creation AND import seed eight department employee PROPOSALS
(Engineering, Design, Marketing, Sales, Finance, Operations, Support, Legal) -
pending_approval, never auto-spending; the board approves the formation in one
decision card ("Staff the formation? [8 employees, $X/mo total cap]") per the
plain-language rule; (2) each seeded employee gets the department instruction
template + optional GOAT persona slot (VIT-42); (3) a company may decline seats
(human-owned departments stay empty with a named human owner note); (4) retrofit:
Anchor (ANC, zero agents) becomes the test case - its formation proposal goes to
the board as the first output of this work.
ACCEPTANCE: creating a test company yields 8 pending proposals + one decision card;
declining leaves a documented human owner; Anchor's formation card reaches the
board; nothing spends before approval.`,
  },
];

const VIT51_STEER = `Board direction (2026-07-16, supersedes parts of the pending IA card): the app must
get MUCH SIMPLER - the proposed IA is too complex as the top level. Re-cut the A-H
slate against the THREE-SURFACE rule: the whole app is (1) CHAT - the WhatsApp inbox,
employee threads + CEO front door; (2) MISSION CONTROL - the new one-screen master
dashboard (see the new Mission Control ticket: vitals strip, formation, roadmap bars,
Summon-Score task queue, decisions badge); (3) DECISIONS - the one-key queue. Plus
Settings, one click deep. Your A (inbox) folds into surface 1; B (formation board)
becomes a ZONE inside Mission Control, not a surface; C (left rail) shrinks to the
three surfaces + company switcher; D-H become below-the-fold or in-surface details -
apply the daily-action test and the Elon delete gate to each. Await
doc/research/BEST-DASHBOARDS.md (in flight) before the revised contact sheet. Produce
ONE new contact sheet pair for the simplified IA; the board decides on that.`;

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
  const vit51 = issues.find((c) => c.identifier === "VIT-51");
  if (vit51) {
    await request("PATCH", `/issues/${vit51.id}`, { comment: VIT51_STEER });
    console.log("steered VIT-51: three-surface simplification directive");
  }
  console.log("\nBatch 10 applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
