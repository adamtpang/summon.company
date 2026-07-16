// VIT-114: post the Anchor formation decision card (request_confirmation) on the
// VIT-114 thread, plus the evidence comment, then move the issue to in_review.
const BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const AGENT_TOKEN = process.env.PAPERCLIP_API_KEY ?? null;

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (AGENT_TOKEN) headers.Authorization = `Bearer ${AGENT_TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
const issue = issues.find((i) => i.issueNumber === 114);
if (!issue) throw new Error("VIT-114 not found");
console.log("issue:", issue.id, issue.status);

const comment = [
  "SOLVED (engine) + one board decision pending (Anchor card).",
  "",
  "Core-8 by default is in source (commit 28a57ce22, branch vitals/vit-41-messages-inbox checkout):",
  "- Company creation AND import (both flow through companyService.create) now seed 8 pending_approval department employees (Engineering, Design, Marketing, Sales, Finance, Operations, Support, Legal) + exactly ONE staff_formation approval: \"Staff the formation? [8 employees, $80/mo total cap]\".",
  "- Each seat carries the department instruction template + an empty optional GOAT persona slot (metadata.vitalsFormation), $10/mo default cap.",
  "- Approve activates seats and sets per-seat budget caps; declinedSeats on approve require a NAMED human owner per declined department and terminate those proposals; reject terminates all seats. Pending proposals are config-frozen and cannot run or spend.",
  "",
  "Evidence:",
  "- Embedded-Postgres acceptance test: creating a company yields 8 pending proposals + 1 pending card, idempotent re-seed (server companies-service tests 12/12 pass).",
  "- staff_formation decide semantics: approvals tests 9/9 pass (activate-all, decline-with-human-owner, reject-terminates-all).",
  "- Shared formation catalog/card/decline tests 22/22 pass; shared + server typecheck clean.",
  "- New files: packages/shared/src/vitals-formation.ts, server/src/services/formation-seed.ts, doc/VIT-114-ANCHOR-FORMATION-CARD.md.",
  "",
  "Rollout: the live packaged runtime predates this change; it ships with the VIT-14 cutover.",
  "",
  "Retrofit: Anchor (ANC) is archived with zero agents, so its formation goes to the board as the request_confirmation card on this thread - accept staffs it (reactivate + 8 seats, $80/mo total), reject leaves it archived; decline seats by rejecting with the department + named human owner.",
].join("\n");

const posted = await request("POST", `/issues/${issue.id}/comments`, { body: comment });
console.log("comment:", posted.id ?? "ok");

const prompt = [
  "Staff the Anchor formation? [8 employees, $80/mo total cap]",
  "",
  "Anchor (ANC) has zero agents and is ARCHIVED. Accept = one decision: (1) reactivate Anchor, (2) staff the core-8 formation - Engineering, Design, Marketing, Sales, Finance, Operations, Support, Legal - one employee per department, $10/mo cap each, $80/mo total. Every seat gets the department instruction template + an empty optional GOAT persona slot.",
  "",
  "Nothing is created and nothing can spend before you accept. Full card: doc/VIT-114-ANCHOR-FORMATION-CARD.md",
  "",
  "Decline seats: reject with the department name + the named human owner (e.g. \"decline Legal - human owner: Adam Pang\"); I staff the rest. Reject outright = Anchor stays archived, zero agents.",
].join("\n");
if (prompt.length > 1000) throw new Error(`prompt too long: ${prompt.length}`);
console.log("prompt length:", prompt.length);

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  idempotencyKey: `confirmation:${issue.id}:anchor-formation-card:2026-07-16`,
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    prompt,
    acceptLabel: "Staff the formation ($80/mo cap)",
    rejectLabel: "Decline / decline seats",
    rejectRequiresReason: true,
    supersedeOnUserComment: true,
  },
});
console.log("interaction:", interaction.id ?? JSON.stringify(interaction).slice(0, 200));

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log("status ->", patched.status);
