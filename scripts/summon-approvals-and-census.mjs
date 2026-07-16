// Batch 15 (2026-07-16): record board approvals (VIT-115 slate, VIT-112 Mission
// Control), encode dept-tag + S-F tier doctrine on VIT-113, then census the full
// board grouped by department for the /cofounder diagnosis. Agents are paused:
// comments record safely without executing.

const API = "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function req(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

const issues = await req("GET", `/companies/${SUMMON_ID}/issues`);
const agents = await req("GET", `/companies/${SUMMON_ID}/agents`);
const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

const APPROVALS = {
  "VIT-115": "BOARD DECISION (2026-07-16): APPROVED. Delete 24 / demote 26 / keep 9 per the inventory. The app becomes three tabs (Dashboard, Chat, Decisions) + Settings + command palette. Execution: cofounder-driven Run 6 worktree (board directive - zero agent token burn). Timeline deletion (D11) fork-divergence cost: accepted.",
  "VIT-112": "BOARD DECISION (2026-07-16): APPROVED. The Mission Control contact sheet (light+dark, 2026-07-16 04:52Z snapshot) is the Dashboard build target. Five fixed zones, honesty gates as rendered (blanked Runway w/ reason, star-proxy note). Build lands with the Run 6 rebuild of /dashboard.",
  "VIT-113": "Board doctrine addition (2026-07-16): (1) EVERY task carries a core-8 department tag (from its owner's department; unassigned tasks get routed a department at triage - no untagged tasks). (2) Tier ladder is S/A/B/C/D/F computed from the Summon Score variables (importance, urgency, time, money): S = the Thiel one-thing per department (max 1 active per agent), A = next in line, B = scheduled, C = backlog, D = someday, F = delete-candidate (feeds via-negativa). Tier renders as a letter chip everywhere the star columns show. Priority enum stays derived for compatibility.",
};
for (const [id, comment] of Object.entries(APPROVALS)) {
  const issue = issues.find((c) => c.identifier === id);
  if (issue) { await req("PATCH", `/issues/${issue.id}`, { comment }); console.log(`recorded on ${id}`); }
}

// ---- census ----
const DEPT = (a) => (a?.metadata?.department ?? (a?.name?.includes("CEO") ? "ceo" : a?.name?.includes("CTO") ? "engineering" : a?.name?.includes("CFO") ? "finance" : a?.name?.includes("CMO") ? "marketing" : a?.name?.includes("COO") ? "operations" : a?.name?.includes("Diagnostician") ? "operations" : "unassigned"));
const TIER = { critical: "S", high: "A", medium: "B", low: "C" };
const open = issues.filter((i) => !["done", "cancelled"].includes(i.status));
const done = issues.filter((i) => i.status === "done");
const stats = {};
for (const i of open) {
  const dept = i.assigneeAgentId ? DEPT(byId[i.assigneeAgentId]) : "unassigned";
  stats[dept] ??= { S: 0, A: 0, B: 0, C: 0, open: 0, in_review: 0, in_progress: 0, blocked: 0 };
  stats[dept][TIER[i.priority] ?? "C"]++;
  stats[dept].open++;
  if (i.status === "in_review") stats[dept].in_review++;
  if (i.status === "in_progress") stats[dept].in_progress++;
  if (i.status === "blocked") stats[dept].blocked++;
}
console.log("\n=== census (open " + open.length + " / done " + done.length + ") ===");
for (const [dept, s] of Object.entries(stats).sort((a, b) => b[1].open - a[1].open)) {
  console.log(dept.padEnd(12), `open:${String(s.open).padStart(3)}  S:${s.S} A:${s.A} B:${s.B} C:${s.C}  review:${s.in_review} wip:${s.in_progress} blocked:${s.blocked}`);
}
console.log("\n=== in_review (board gate) ===");
for (const i of open.filter((x) => x.status === "in_review")) console.log(i.identifier, i.title.slice(0, 60));
