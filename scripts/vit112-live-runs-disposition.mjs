// One-off: VIT-112 heartbeat disposition — acknowledge the LIVE AGENT RUNS board
// addition, attach evidence, request board confirmation of the zone design, move
// the issue to in_review. Idempotent via interaction idempotencyKey.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const KEY = process.env.PAPERCLIP_API_KEY;

async function request(method, path, body) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (KEY) headers.authorization = `Bearer ${KEY}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const issues = await request("GET", `/companies/${process.env.PAPERCLIP_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310"}/issues`);
const issue = issues.find((i) => i.identifier === "VIT-112");
if (!issue) throw new Error("VIT-112 not found");

const comment = await request("POST", `/issues/${issue.id}/comments`, {
  body: [
    "Board addition received and integrated. Decision (Design Director): LIVE AGENT RUNS is the **formation zone's live mode**, not a sixth zone - the formation grid is already the roster of who can work, so \"who is working right now\" is a state of that grid, not a second one. Zone count stays 5 of 7. Fleet scope lives in the existing sidebar company list as a per-company running-count strip (StarCraft minimap), one click into that company's Mission Control.",
    "",
    "Everything on the zone is runtime-proven, verified live today: `GET /companies/:id/live-runs` supplies status (running/queued), startedAt (real elapsed timer), agentName, issueId (task one-liner), and outputSilence (server-side 1h/4h stuck thresholds - the only warning state). Archetype grouping reuses the existing Formation departmentMatchScore mapping plus CEO by role - no new taxonomy. Real snapshot at capture: 5 running / 15 queued / 2 idle / 3 unstaffed in Company Zero, 4 running in Quantus - the CTO's 10-deep queue and three unstaffed departments are exactly the idle-capacity signal this zone exists to surface.",
    "",
    "Evidence (commit dccaccdf4 on vitals/vit-41-messages-inbox):",
    "- Zone spec: doc/design/VIT-112-MISSION-CONTROL.md (zone ledger + full LIVE AGENT RUNS spec: card anatomy, states, click paths, data contract, gates compliance)",
    "- Contact sheet, light + dark, real Company Zero data: doc/design/vit-112-live-runs-contact-sheet.png (+ .html source)",
    "",
    "Confirmation requested below on the zone design. The full one-screen contact sheet still waits on doc/research/BEST-DASHBOARDS.md landing (issue's named research source); this zone spec is independent of it and ready to lock now.",
  ].join("\n"),
});

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  title: "Approve the LIVE AGENT RUNS zone design (formation live mode + sidebar fleet strip)",
  continuationPolicy: "wake_assignee",
  idempotencyKey: `confirmation:${issue.id}:live-runs-zone:v1`,
  payload: {
    version: 1,
    prompt:
      "Approve the LIVE AGENT RUNS zone design: placed as the formation zone's live mode (zone count stays 5/7), fleet view as a running-count strip in the existing sidebar company list, nine archetypes = CEO + the eight departments via the existing Formation mapping, all fields runtime-proven (live-runs endpoint). Or request changes.",
    acceptLabel: "Approve zone design",
    rejectLabel: "Request changes",
    detailsMarkdown:
      "Contact sheet (light + dark, real Company Zero snapshot 2026-07-16): doc/design/vit-112-live-runs-contact-sheet.png. Spec: doc/design/VIT-112-MISSION-CONTROL.md. Commit dccaccdf4. On acceptance this zone is locked into the full Mission Control contact sheet once doc/research/BEST-DASHBOARDS.md lands.",
  },
});

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log(JSON.stringify({
  issue: issue.identifier,
  commentId: comment?.id ?? null,
  interactionId: interaction?.id ?? null,
  status: patched?.status ?? null,
}, null, 2));
