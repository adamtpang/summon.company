// Batch 4 (2026-07-15 night): every surfaced-but-unfiled problem/change becomes a
// ticket, per board directive "every problem we've surfaced and proposed change log
// as a ticket". Staged unassigned. Idempotent by exact title.

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
    title: "Mobbin research: mine the best desktop app UI/UX patterns and adopt them",
    priority: "medium",
    proposedOwner: "Vitals Design Director",
    description: `Board directive: research the best desktop UI/UX apps on mobbin.com and use the
patterns for Summon. Mobbin's desktop/web app library (mobbin.com/browse/web/apps or
the desktop category) catalogs real product screens - flows, empty states, settings,
onboarding, command palettes.

SCOPE: (1) curate 8-12 reference apps on Mobbin relevant to an AI-employee console
(Linear, Slack, Notion, Raycast, Superhuman, Height, Cron/Notion Calendar, Arc, and
AI-agent tools if present); (2) for each, capture the screens that answer a Summon
surface: messaging inbox (VIT-41), agent/org roster, usage dashboards (VIT-48),
settings/model pickers (VIT-37), onboarding, empty states; (3) produce
doc/research/MOBBIN-PATTERNS.md - pattern name, source app + screen link, and the
Summon surface it maps to; (4) feed the top patterns into the Run 5 design-system
work (VIT-35) as annotated references.
NOTE: Mobbin may require a login - the board (Adam) can screenshot-share flows if a
paywall blocks; the ticket is done when the doc exists with >=15 adoptable patterns
each mapped to a Summon surface. Cross-reference doc/research/DESKTOP-UX-SKELETONS.md
(Claude/Codex desktop anatomy) so the two docs disagree nowhere.`,
  },
  {
    title: "Adopt the desktop-UX skeleton findings (Claude Desktop + Codex desktop research)",
    priority: "medium",
    proposedOwner: "Vitals Design Director + Vitals Engineer",
    description: `Adopt doc/research/DESKTOP-UX-SKELETONS.md (board-run research: Claude Desktop and
Codex/ChatGPT desktop anatomy - layout, session lists, background-task display, model
pickers, usage/limits UX, approvals, command palettes - plus best-in-class workspace
patterns). When the doc lands: (1) extract its proposed information architecture for
Summon desktop (left-rail sections, main surfaces, tray behavior, command-palette
verbs); (2) board-review the IA on a contact sheet; (3) file one implementation
sub-issue per approved surface change. Blocked-by: the research doc landing at
doc/research/DESKTOP-UX-SKELETONS.md.`,
  },
  {
    title: "Summon rebrand sweep: retire 'Vitals/vitals.run' naming from the control plane, desktop app, and agents",
    priority: "medium",
    proposedOwner: "Vitals COO (coordination) + Vitals Engineer (code)",
    description: `WHY: The product is SUMMON (decided 2026-07-14; NORTH_STAR.md) - "vitals" survives
only as the scoreboard/EKG name. But the plane still says Vitals everywhere:
apps/desktop package.json productName "Vitals"; agents named "Vitals CEO/CTO/...";
project "vitals.run Company Zero"; workspace was "vitals.run monorepo" (already
repointed to summon.company on 2026-07-15); UI copy and window title.

SCOPE (additive-safe): (1) desktop app: productName, window title, tray tooltip,
splash - "Summon"; keep icon pending VIT-36 logo; (2) control plane data: rename
agents "Vitals X" -> "Summon X" (verify nothing keys on agent NAME - the bootstrap
scripts look up by name, so update scripts in the same change), project name, company
description; (3) UI copy sweep for user-facing "Vitals" (the EKG/scoreboard KEEPS the
name by design); (4) do NOT rename @paperclipai/* packages, PAPERCLIP_* env, DB/API/
protocol surfaces (CLAUDE.md golden rule).
ACCEPTANCE: fresh screenshots show Summon naming end to end; bootstrap + status
scripts still run green; grep finds "Vitals" only in the scoreboard context and
upstream-protected names.`,
  },
  {
    title: "Fix queued comment-wakes reopening terminal issues after runtime restart",
    priority: "high",
    proposedOwner: "Vitals CTO (runtime) - currently Codex-blocked until Jul 22",
    description: `WHY: The known bug that forced pausing the CTO and Design Director: queued comment
wakeups can reopen TERMINAL (done/cancelled) issues after a packaged-runtime restart,
making comments on closed work behave as executable wake events (CLAUDE.md "S0 exact
blocker" section documents the operating hazard). This poisons the dogfood loop: the
board should be able to comment freely without resurrecting closed work.

SCOPE: (1) reproduce: queue a comment wake on a terminal issue, restart the packaged
runtime, observe the reopen; (2) fix: wake events must check issue status at
DELIVERY time (not enqueue time) and drop, with an audit event, when the issue is
terminal; (3) make wake semantics explicit: comments on terminal issues = recorded
conversation, never execution; a deliberate reopen requires the reopen flag; (4)
regression test + unpause criteria for CTO/Design Director documented.
ACCEPTANCE: the repro no longer reopens; dropped wakes appear as audit events; CTO and
Design Director can be unpaused without wake-storm risk.`,
  },
  {
    title: "Issue -> Task rename run (product language)",
    priority: "low",
    proposedOwner: "Vitals Engineer",
    description: `The remaining tune-session roadmap item (DECISION-SHEET "Tune session - CLOSED"
notes: "Remaining roadmap: ... issue->task rename run"). Employees do TASKS; "issue"
is tracker jargon. SCOPE: user-facing copy + routes rename issue->task with redirects,
preserving API/DB names (golden rule); update tests in lockstep; coordinate with the
WhatsApp messaging surface (VIT-41) so the vocabulary lands once.
ACCEPTANCE: UI says tasks everywhere user-facing; old /issues routes redirect; suite
green.`,
  },
  {
    title: "Turn on the ESLint design-token ratchet",
    priority: "low",
    proposedOwner: "Vitals Engineer",
    description: `The final tune-session roadmap item: after Run 4 (VIT-34) retires palette classes,
turn on the ESLint ratchet so regressions are impossible - new hardcoded visual
values fail CI, allowlist inherits from check:token-gates. Blocked-by: VIT-34.
ACCEPTANCE: lint fails on a seeded hardcoded hex/palette class in ui/src; passes on
master; wired into CI and the pre-commit path.`,
  },
  {
    title: "Dogfood daily-driver: make the desktop app the board's default way to run Summon",
    priority: "high",
    proposedOwner: "Vitals Engineer + Vitals Design Director",
    description: `WHY: The board directive is Cursor-grade dogfooding: Adam lives IN the desktop app
and improves Summon using Summon. The shell exists (apps/desktop: chromeless window +
tray attaching to 127.0.0.1:3100/VIT, npm start) but daily-driver friction remains.

SCOPE:
1. Launch-on-login (Windows): auto-start minimized to tray; the control plane comes
   up with it (attach-or-start already in main.js - verify the start path works when
   the server is cold).
2. One-click launch artifact NOW (a Start-Menu/Desktop shortcut to the dev shell) as
   the bridge until VIT-29 (NSIS installer) ships.
3. THE DOGFOOD FLYWHEEL (the point): a global "report a papercut" affordance in the
   app - hotkey + tray menu item that captures a screenshot + current route + note
   and files it as a Summon issue via the API, tagged papercut. Every friction Adam
   feels becomes a ticket in one keystroke - the product improving itself.
4. Crash/error surfaced gracefully: if the server dies, the window shows a
   reconnect state with one-click restart, never a dead white screen.
ACCEPTANCE: cold boot -> tray icon present -> window opens to the company in <10s;
papercut hotkey files a real issue with screenshot attached; board runs a full day
in the app without touching a browser tab.`,
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
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  ${spec.title}`);
  }
  console.log("\nBatch 4 staged (unassigned).");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
