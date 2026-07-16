// One-shot heartbeat script for VIT-59 (2026-07-15, Vitals CMO):
// 1) create the unblocked prerequisite child issue, 2) comment the spec+evidence
// on VIT-59, 3) mark VIT-59 blocked with first-class blockers (VIT-41 + child).
const BASE = "http://127.0.0.1:3100/api";
const COMPANY_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const VIT59_ID = "b993a2de-5c79-4571-989a-3833999575fa";
const VIT41_ID = "fbe4104c-7bc4-4186-ac30-8d0c6504cda9";
const CMO_AGENT_ID = "6d97a261-4037-4dfe-acc8-9db11e847501";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const CHILD_TITLE =
  "Support/hello inbox exists and is published: real user email can reach the board";

const existing = await request("GET", `/companies/${COMPANY_ID}/issues`);
let child = existing.find((i) => i.title === CHILD_TITLE);
if (!child) {
  child = await request("POST", `/companies/${COMPANY_ID}/issues`, {
    parentId: VIT59_ID,
    title: CHILD_TITLE,
    description: [
      "WHY: prerequisite for VIT-59 acceptance. Evidence (2026-07-15): a 90-day search of the board's connected Gmail (adamtpangelinan@gmail.com) for vitals/summon/waitlist inbound returned only Vercel receipts - zero user emails. No support@/hello@ address exists or is published on vitals.run / summon.company, so the VIT-59 acceptance test (a real user email appears as a thread) has nothing to run on.",
      "",
      "SCOPE (CMO-owned, NOT blocked by VIT-41):",
      "1. Stand up a support/hello address that lands in the board's Gmail (alias or forwarding), under a dedicated label (proposed: Summon/Users).",
      "2. Wire vitals.run and summon.company contact points (footer mailto, waitlist confirmation reply-to) to it - publishing to the live site is a board-approval gate.",
      "3. Verify end-to-end: send a real test email, confirm it lands under the label.",
      "",
      "Spec: doc/design/VIT-59-USERS-LANE.md in the summon.company repo.",
    ].join("\n"),
    status: "todo",
    priority: "high",
    assigneeAgentId: CMO_AGENT_ID,
  });
  console.log("child created:", child.id, `VIT-${child.issueNumber}`);
} else {
  console.log("child already exists:", child.id, `VIT-${child.issueNumber}`);
}

const comment = [
  "[Vitals CMO - VIT-59 heartbeat 2026-07-15]",
  "",
  "Acknowledged assignment. Durable progress this heartbeat, then blocking on the stated sequence:",
  "",
  "1. DEPENDENCY CHECK: VIT-41 (employee inbox) is still in_progress - ui/src/pages/Messages.tsx is an explicit draft-only prototype (transcript is local state pending the VIT-40 continuity backend). There is no shipped inbox to add a Users lane to yet, and the issue itself sequences this work AFTER VIT-41 ships.",
  "",
  "2. CHANNEL EVIDENCE: the board's connected Gmail (adamtpangelinan@gmail.com) has ZERO inbound user email about vitals/summon in the last 90 days (only Vercel receipts matched). No support@/hello@ address exists or is published on either site. The acceptance test ('a real user email appears as a thread') currently has nothing to run on.",
  "",
  `3. UNBLOCKED PREREQUISITE split out as child issue VIT-${child.issueNumber} (CMO-owned): stand up the support/hello address, wire site contact points to it (board approves anything published), verify a real test email lands. This does not wait on VIT-41.`,
  "",
  "4. SPEC written to doc/design/VIT-59-USERS-LANE.md: Gmail label 'Summon/Users' -> Users section beside the employee lane in the VIT-41 inbox; agent drafts in the board's own Gmail (create-draft only, agent never sends); board approves via existing interaction machinery with an audit event; board sends from their own account; thread sync makes the full exchange readable. Email is the only channel until this loop works end-to-end (OPENCLAW-LEARNINGS).",
  "",
  `DISPOSITION: blocked. First-class blockers: VIT-41 (unblock owner: its assignee, action: ship the employee inbox) and VIT-${child.issueNumber} (unblock owner: Vitals CMO, action: live support/hello address with a verified real inbound email). The blockers-resolved wake resumes this issue when both close.`,
].join("\n");

await request("POST", `/issues/${VIT59_ID}/comments`, { body: comment });
console.log("comment posted on VIT-59");

const patched = await request("PATCH", `/issues/${VIT59_ID}`, {
  status: "blocked",
  blockedByIssueIds: [VIT41_ID, child.id],
});
console.log("VIT-59 patched:", patched.status, "blockedBy:", (patched.blockedBy ?? []).length);
