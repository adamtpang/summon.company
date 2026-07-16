// Batch 7 (2026-07-15): the board scoreboard (stars + progress + chat side-by-side)
// and the CEO self-diagnosis autopilot. Staged; scoreboard -> Engineer+Design queue,
// CEO autopilot -> CTO queue (runtime) with CEO as the operating agent.
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
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const issues = [
  {
    title: "Board scoreboard: star-rated priorities table + progress bars, side-by-side with chat",
    priority: "critical",
    ownerName: "Vitals Engineer",
    description: `WHY (board, 2026-07-15): the board wants to see, at a glance and NEXT TO the chat
surface: every task, its IMPORTANCE (0-5 stars) and URGENCY (0-5 stars), the assigned
AI employee, and a progress bar - the company's priorities as one clean table.

SOLUTION (additive; coordinates with VIT-41 chat inbox + VIT-61 parallel lanes):
1. DATA: add two additive 0-5 integer fields to tasks - importanceStars, urgencyStars
   (additive columns or a JSON attributes field; NEVER repurpose the existing priority
   enum - keep it derived: 5/5-ish -> critical, etc., so nothing upstream breaks).
   Backfill from the current triage mapping.
2. PROGRESS: per-task progress derived from real signals, never self-reported:
   acceptance-criteria checkboxes checked / total when present, else stage-of-life
   (todo 0% -> woken 10% -> run started 25% -> evidence posted 60% -> board review
   90% -> done 100%). Per-company progress bar = weighted completion of critical+high
   tasks; roadmap stage bars reuse the VIT-13 view mechanics.
3. SURFACE: a Priorities panel docked beside the chat inbox (split view): sortable
   table - task, importance stars, urgency stars, owner avatar, progress bar,
   time-in-state. Clicking a row opens the task's thread IN the chat pane (chat-first
   doctrine: the table is the map, chat is the territory).
4. Stars are board-editable inline (click to set); agents may PROPOSE star changes
   with a reason, board confirms.
ACCEPTANCE: board sees all company tasks with stars/owner/progress next to chat;
row-click opens the thread; stars persist; progress moves when evidence lands (demo
with a real ticket); light+dark screenshots posted here before merge.`,
  },
  {
    title: "CEO self-diagnosis autopilot: read the vitals, surface problems, file starred tasks",
    priority: "critical",
    ownerName: "Vitals CTO",
    description: `WHY (board, 2026-07-15): the CEO should self-diagnose the company - e.g. "too much
spend and too little revenue" - and CREATE tasks / surface problems into the task
list without being asked. This is the diagnosis loop (VIT-11 S4 machinery) promoted
into the CEO's standing heartbeat.

SOLUTION (CTO owns the wiring; the CEO agent operates it):
1. VITALS SNAPSHOT on each CEO heartbeat: spend (agent ledgers/budget caps), revenue
   (Stripe when connected; else the goal's revenue metric), task flow (created vs
   completed vs stalled >72h), quota headroom (VIT-48 data), streak/roadmap stage.
2. ANOMALY RULES (start dumb + legible, LLM judgment second): spend pace > cap pace;
   revenue == 0 while spend > $X; any critical task stalled; quota forecast < 48h;
   department with zero active work. Each rule -> a PROBLEM with evidence numbers.
3. ACTION: CEO files the problem as a task with proposed importance/urgency stars +
   one-line why + evidence, assigns the correct department owner (or proposes a hire
   if no owner exists - board approves hires), and posts a one-line summary to the
   board feed. NO spend, NO external sends - filing and surfacing only.
4. DEDUP: an anomaly already open as a task gets a comment update, not a duplicate
   (loop-until-dry discipline; never re-file what the board closed - record and stop).
ACCEPTANCE: seed a test anomaly (e.g. mock spend spike) -> CEO heartbeat files a
starred, evidenced, correctly-assigned task and a board-feed line; closed problems
are not re-filed; a week of heartbeats produces zero duplicate tasks.`,
  },
];

async function main() {
  const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
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
        assigneeAgentId: byName[spec.ownerName]?.id,
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  -> ${spec.ownerName}`);
  }
  console.log("\nScoreboard + CEO autopilot filed.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
