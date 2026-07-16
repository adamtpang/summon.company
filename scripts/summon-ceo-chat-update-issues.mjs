// Batch 5 (2026-07-15): CEO chat front door + relaunch-to-update UX.
// Staged unassigned. Idempotent by exact title.

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
    title: "CEO chat: talk to any company's CEO like Claude Code, and the CEO routes the work",
    priority: "high",
    proposedOwner: "Vitals Engineer + Vitals Design Director",
    description: `WHY: The board should open any company and just TALK - one always-available
conversation with that company's CEO agent, exactly like chatting in Claude Code.
No picking issues, no forms. This is the Dispatch pattern from
doc/research/DESKTOP-UX-SKELETONS.md (steal #8: "message the company, not a config
form" - Claude Desktop's Dispatch routes dev work to sessions and reports OUTCOMES,
not process steps).

SOLUTION (builds on VIT-40 continuity + VIT-41 messaging; CEO = the front door):
1. Every company gets a persistent CEO thread pinned at the top of its Messages
   surface (and reachable via Ctrl+K "Talk to <company> CEO"). One thread, forever -
   full continuity per VIT-40.
2. The CEO acts as the router: a board message becomes (a) a direct answer, (b) a
   new issue assigned to the right department employee, or (c) a delegation with a
   report-back - and the CEO says which it did in one line ("Filed as VIT-61 ->
   Engineer. I'll report when there's evidence.").
3. Outcome-first reporting: the CEO thread surfaces results and blockers, never
   run transcripts (those stay one click deep on the issue).
4. Works per company: Summon CEO, Quantus CEO, future Anchor CEO - same affordance,
   switched by the company switcher.
ACCEPTANCE: from a cold app open, board can reach the Summon CEO thread in <=2
interactions, ask "what's our constraint right now?" and get a grounded answer; a
"please fix X" message produces a filed+assigned issue with the identifier echoed
back; the same works for Quantus. Continuity: reopening the thread days later
retains context (VIT-40 mechanics).`,
  },
  {
    title: "Relaunch-to-update: Claude-style update toast + a dev loop with zero reinstalls",
    priority: "high",
    proposedOwner: "Vitals Engineer (CTO consult on VIT-14 packaged/source seam)",
    description: `WHY: The board asked "every time I change Summon, do I reinstall?" The answer must
become: NEVER. Claude Desktop's contract - a toast says "Update ready - Relaunch" -
is the target. Architecture already helps: the desktop shell is a thin webview on
127.0.0.1:3100 (apps/desktop/main.js loadURL), so the app's UI is whatever the local
server serves.

THE ACTUAL GAP (be honest about it): the live instance is the PACKAGED runtime
(npm 2026.707.0), which serves its own bundled UI - source edits in ui/ never reach
it (the S0/VIT-14 seam). So today's real flow for seeing your own changes is running
the SOURCE instance, not reinstalling anything.

SOLUTION, three tiers:
1. DEV LOOP (dogfood daily): a "dev mode" for the desktop shell - env flag or tray
   toggle - that targets the source instance (pnpm dev, e.g. :3102 like the brand
   preview) with Vite HMR, so ui/ edits appear LIVE without even a reload. Document
   the loop in apps/desktop/README.md; make 'pnpm dev:desktop' one command that
   boots source server + shell together.
2. RUNTIME UPDATES (packaged): when a new packaged version exists (npm dist-tag
   check on an interval), show the in-app banner "Summon vX ready - Restart to
   update" (extend the existing DevRestartBanner.tsx machinery); restart = graceful
   server restart + window reload, honoring the no-restart-while-runs-active rule
   (CLAUDE.md governance).
3. SHELL UPDATES (rare): electron-updater wired to the NSIS artifact (pairs with
   VIT-29 installer); same toast pattern - "Relaunch to update".
ACCEPTANCE: (dev) edit a ui/ component -> change visible in the desktop window
without reinstall or manual rebuild; (runtime) with a newer packaged version
available, the banner appears and one click updates + relaunches with zero data
loss and only when no runs are active; (shell) electron-updater update path smoke-
tested on Windows. README documents which tier a given change falls into.`,
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
  console.log("\nBatch 5 staged (unassigned).");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
