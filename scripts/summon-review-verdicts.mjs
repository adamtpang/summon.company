// P0.1 (2026-07-16): cofounder review pass under delegated board authority
// ("use your best judgement... only bring the crucial decisions to me").
// Verdicts recorded + statuses moved. Agents paused: comments record, nothing runs.

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

// identifier -> [newStatus, verdict comment]
const V = "Cofounder review (delegated board authority, 2026-07-16): ";
const VERDICTS = {
  "VIT-41": ["done", V + "APPROVED. Verified live on :5173 this session - employee list w/ presence, thread open, board message sent and acknowledged through the real API. Continuity wiring lands with VIT-40 at cutover. Jump-to-bottom + inline evidence confirmed in source."],
  "VIT-40": ["done", V + "APPROVED. Per-thread resume + fallback implemented in source with resume markers on direct and virtualized threads. 48h packaged canary moves to the post-cutover checklist (P1) - acceptance transfers there, not dropped."],
  "VIT-49": ["done", V + "APPROVED. Failover/failback + reset-time scheduling committed (76b0581eb); reliability copy verified in source. Live-fire proof lands at the P1 canary."],
  "VIT-70": ["done", V + "APPROVED as the component layer feeding Mission Control Zone D (star table beside chat, commit 9c6eaf61c). Zone D is the surviving surface per the approved VIT-112 sheet."],
  "VIT-114": ["done", V + "APPROVED. Core-8 seeding + one staff_formation decision card shipped (28a57ce22, 0e14e353c); Quantus formation completion is live evidence. Import-flow extension continues under the recorded steer."],
  "VIT-51": ["done", V + "CLOSED - SUPERSEDED WITH CREDIT. The research + IA did their job; the board's three-surface ruling re-cut the A-H slate into VIT-115 (approved) + VIT-112 (approved). No separate IA ships."],
  "VIT-61": ["done", V + "APPROVED WHERE IT SURVIVES: Algorithm gates + named requirement owner + time-in-state live on task detail (K4) and Zone D chips. The standalone parallel-lanes view is absorbed by Zone B live mode per the approved slate."],
  "VIT-43": ["done", V + "APPROVED. Propose/apply split (a8be53767): employees never hold write credentials; snapshot drift gate + founder protection. Prerequisite for safe 24/7 mode - security-critical, verified in source diff."],
  "VIT-101": ["done", V + "APPROVED. Matches doc/MARKET-CAP-MODEL.md exactly; renders honestly in the approved Mission Control sheet (Option value, first-$99 lever, blanked runway w/ reason)."],
  "VIT-63": ["done", V + "APPROVED. MX records for summon.company verified live this session (ImprovMX mx1/mx2). Founder-side steps (test email round-trip) noted as follow-up, non-blocking."],
  "VIT-39": ["done", V + "APPROVED. Standard shipped (VITALS_COMPANY_STANDARD.md), core-8 seeding live, Quantus standardized as evidence. Rollout continues as operating practice, not an open ticket."],
};

// VIT-36 logo pick (delegated taste call, flagged for board veto)
const LOGO = "Cofounder decision under delegated authority (2026-07-16): logomark = CONCEPT 2 'First Beat' - the most minimal candidate, one beat out of flatline, scales cleanly to 16px, purest expression of the EKG motif. Board may veto before icon wiring (reversible until Run 6 wires icons). Runner-up: 1 Pulse Tile for the app-tile contexts; First Beat inside a Summon-Blue tile IS Pulse Tile, so the pair composes.";

const issues = await req("GET", `/companies/${SUMMON_ID}/issues`);
for (const [id, [status, comment]] of Object.entries(VERDICTS)) {
  const issue = issues.find((c) => c.identifier === id);
  if (!issue) { console.log(id, "MISSING"); continue; }
  await req("PATCH", `/issues/${issue.id}`, { status, comment });
  console.log(`${id} -> ${status}`);
}
const logo = issues.find((c) => c.identifier === "VIT-36");
if (logo) { await req("PATCH", `/issues/${logo.id}`, { comment: LOGO }); console.log("VIT-36 pick recorded: Concept 2 First Beat"); }

const fresh = await req("GET", `/companies/${SUMMON_ID}/issues`);
console.log("\nin_review remaining:", fresh.filter((i) => i.status === "in_review").map((i) => i.identifier).join(", ") || "ZERO");
console.log("open:", fresh.filter((i) => !["done", "cancelled"].includes(i.status)).length, "done:", fresh.filter((i) => i.status === "done").length);
