// Batch 8 (2026-07-15): Decisions tab (CEO-funneled), iOS TestFlight app,
// jump-to-bottom steer into VIT-41, wireframe approval onto VIT-70.
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

const newIssues = [
  {
    title: "Decisions tab: every decision funnels through the CEO to the board, one-key fast",
    priority: "critical",
    ownerName: "Vitals Engineer",
    description: `WHY (board, 2026-07-15): "all decisions should be brought to me from the CEO agent,
so it's easy for me to decide." Deciding is the board's core job (NORTH_STAR game loop
step 5); today decisions are scattered across issue comments, review states, and hire
approvals.

SOLUTION (pairs with VIT-45 durable approval gates + the decision-queue pattern in
doc/research/DESKTOP-UX-SKELETONS.md steal #1):
1. FUNNEL RULE: agents never ping the board directly for a decision. They route to the
   CEO, who PACKAGES it: one-line question, the CEO's recommendation + one-line why,
   evidence links, reversibility note (reversible -> CEO may proceed-by-default after
   24h; irreversible -> waits forever). The packaging is what makes deciding easy.
2. SIDEBAR TAB "Decisions" with a badge count: a card stack, newest last-blocking
   first. Card anatomy: question, recommendation, evidence, impact stars, the options.
3. ONE-KEY VERBS: y approve / n reject / d defer / j,k navigate; every decision
   resolves in one screen without navigation. Enter opens the underlying thread only
   when the board wants depth.
4. Every resolution writes to the company decision log (what/why/who) - the same
   decisions vocabulary as the vitals schema - and unblocks the suspended run
   (VIT-45 mechanics).
ACCEPTANCE: an agent needing sign-off produces a CEO-packaged card in the tab within
one heartbeat; board resolves 5 seeded decisions in under 60 seconds using only the
keyboard; resolutions appear in the decision log and resume the blocked work; badge
counts match reality. Light+dark screenshots posted before merge.`,
  },
  {
    title: "Summon on iOS: TestFlight app so the board runs the company from the phone",
    priority: "high",
    ownerName: "Vitals Engineer",
    description: `WHY (board, 2026-07-15): "I want to be working on this similar to Dispatch, on my
phone." The board's job - chat + decisions - is a phone-shaped job; the desktop is
for depth.

SOLUTION (v1 pragmatic, not a rewrite):
1. WRAPPER v1: a Capacitor (WKWebView) iOS shell around the existing responsive web
   UI - the same move as apps/desktop, phone-sized. Scope v1 surfaces: chat inbox
   (VIT-41), Decisions tab, the scoreboard (VIT-70), notifications. Deep console
   work stays desktop.
2. CONNECTIVITY: the control plane lives on the board's desktop (127.0.0.1:3100).
   Phone reaches it over Tailscale (private mesh; the OpenClaw ansible posture -
   never expose the plane publicly). App settings = one field: the Tailscale URL.
3. PUSH: APNs notifications for decision cards and finished runs ("decide" from the
   lock screen is the Dispatch moment). Until APNs lands, poll-on-open is acceptable
   for TestFlight build 1.
4. TESTFLIGHT: bundle id, icons (VIT-36 logo output), privacy strings, EAS or Xcode
   build, internal TestFlight distribution to the board.
BOARD-ONLY DEPENDENCIES (flag, do not block): Apple Developer Program enrollment
($99/yr) + agreeing to Apple terms + Tailscale account login are board actions -
prepare everything, hand the board a 10-minute checklist.
ACCEPTANCE: board installs from TestFlight on iPhone, opens the chat inbox and
Decisions tab over Tailscale, resolves a real decision and sends a real employee
message from the phone; reconnect behavior sane on network switch; screenshots
posted. GUARDRAIL: no public exposure of the control plane; keys never leave the
desktop (NORTH_STAR Drift rule).`,
  },
];

const steers = [
  {
    identifier: "VIT-41",
    comment: "Board addition (small, in-scope): every chat thread needs a floating jump-to-bottom affordance - a down-arrow button that appears whenever the view is scrolled up, one tap/click snaps to the latest message (with unread count on the button if messages arrived while scrolled up). The board uses it to regain last context fast. Standard messaging pattern; include in this build, not a separate ticket.",
  },
  {
    identifier: "VIT-70",
    comment: "Board decision: the scoreboard wireframe is APPROVED as rendered in the board session 2026-07-15 (progress header: N tasks / agents live / done + overall bar; table columns: Task, Importance stars, Urgency stars, Agent, Progress bar with state label; review-needed rows highlighted and sorted to top). Build to this shape; propose deltas as comments with a reason rather than diverging silently.",
  },
];

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
  for (const s of steers) {
    const issue = issues.find((c) => c.identifier === s.identifier);
    if (!issue) { console.log(`${s.identifier} missing - steer skipped`); continue; }
    await request("PATCH", `/issues/${issue.id}`, { comment: s.comment });
    console.log(`steered ${s.identifier}`);
  }
  console.log("\nBatch 8 applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
