// One-off: VIT-61 — post the Elon-operating-model UI delivery, open the board
// contact-sheet confirmation, set in_review. Authors as the agent when
// PAPERCLIP_API_KEY is set.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";
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
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// NOTE: forward slashes only in bodies — backslash paths 500 the comments API (VIT-66).
const COMMENT = `**All four deliverables implemented and committed as \`9576ac925\` on \`vitals/vit-41-messages-inbox\` — contact sheet ready for board review.**

**(1) Algorithm strip on task detail** — five gates in order (Requirements? -> Delete? -> Simplify -> Accelerate -> Automate), derived entirely from data tasks already carry. Gate 1 names the requirement owner (creating agent by name, or "Board" — never a department) and flags anonymous requirements loudly. Gate 2 exposes **Propose deletion** while work is still cheap to delete: it posts a structured comment the board approves by cancelling the task. Gate 4 carries the time-in-state reading and escalates when the timeline is long. See \`doc/design/evidence/VIT-61/detail-VIT-61-light.png\` — the strip dogfooding on this very task.

**(2) Parallel lanes as the tasks default view** — one lane per agent including idle agents (an empty lane is information), busiest first, Unassigned last in amber. True dependencies draw as SVG edges between chips (open blockers solid red, resolved dashed) with the header counting active serialization: "serialization must justify itself." Live data shows 5 active dependency edges across Company Zero (\`lanes-default-dark.png\`). Existing list/board views remain one toggle away; stored view preferences win over the new default.

**(3) Time-in-state on every task chip** — list rows (desktop + mobile), kanban cards, and lane chips all carry an age chip. Honest anchors (no statusChangedAt exists): working -> startedAt, review/blocked -> updatedAt (lower bound, so we under-escalate), waiting -> createdAt. Calm ages are quiet mono text; aging (24h active / 7d waiting) turns amber; wrong (72h / 14d) turns red with the render rule in the tooltip.

**(4) Box-in-a-box audit filed** — DECISION-SHEET section D, findings D1-D7 PENDING board ruling: Inbox vs Decisions is the core duplicated enclosure; Approvals + JoinRequestQueue are Inbox subsets; two drifted settings navs; two "General" labels; three words for one liveness state ("Live"/"Running"/"Working now"); the self-contradictory agent \`active\` mapping.

**Coordination:** VIT-41 (chat surface) untouched — Messages' unread counter is flagged in D1's badge-unification rather than changed under it. VIT-13 roadmap and formation views untouched; lanes complement rather than replace them. Design doc: \`doc/design/VIT-61-ELON-UI.md\`.

**Verification:** 30 new tests + affected suites (IssueRow, IssuesList, Issues, IssueDetail, Inbox) green; full ui typecheck + production build pass; token gates add zero new violations. Evidence (light/dark, desktop/mobile, real data): \`doc/design/evidence/VIT-61/\`, captured via \`scripts/vit-61-elon-ui-evidence.mjs\`.

**Board decision requested:** review the contact sheet and confirm to approve the shipped defaults (lanes as default tasks view, age-chip thresholds 24h/72h + 7d/14d, propose-deletion wording) — or comment with changes and I revise. Section D dedup findings are separate board rulings on the decision sheet.`;

async function main() {
  const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const issue = issues.find((c) => c.identifier === "VIT-61");
  if (!issue) throw new Error("VIT-61 not found");

  const comment = await request("POST", `/issues/${issue.id}/comments`, { body: COMMENT });
  let interaction = null;
  let statusUpdated = null;
  try {
    interaction = await request("POST", `/issues/${issue.id}/interactions`, {
      kind: "request_confirmation",
      title: "Approve the Elon-operating-model UI (Algorithm gates, lanes, time-in-state)",
      body:
        "Review doc/design/evidence/VIT-61/ (lanes-default, board-age-chips, list-age-chips, detail-VIT-61, detail-VIT-4, lanes-mobile — light + dark). Confirm to approve lanes as the default tasks view, the age-escalation thresholds, and the Algorithm strip as shipped; reject or comment to request changes. DECISION-SHEET section D (D1-D6 dedup findings) stays open for separate rulings.",
      continuationPolicy: "wake_assignee",
      idempotencyKey: `confirmation:${issue.id}:vit61:elon-ui-v1`,
    });
  } catch (err) {
    console.error("interaction failed (non-fatal):", err.message);
  }
  try {
    statusUpdated = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
  } catch (err) {
    console.error("status patch failed (non-fatal):", err.message);
  }
  console.log(
    JSON.stringify(
      {
        issue: issue.identifier,
        commentId: comment?.id ?? null,
        interactionId: interaction?.id ?? null,
        status: statusUpdated?.status ?? "unchanged",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.stack ?? e.message);
  process.exitCode = 1;
});
