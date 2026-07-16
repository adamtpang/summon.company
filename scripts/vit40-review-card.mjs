// VIT-40: create the board review card (request_confirmation, wake_assignee) and
// move the issue to in_review. Evidence comment already posted this heartbeat.
const BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const KEY = process.env.PAPERCLIP_API_KEY ?? "";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
const issue = issues.find((i) => /VIT-40$/.test(i.identifier || ""));
if (!issue) throw new Error("VIT-40 not found");

const prompt = [
  "Accept the VIT-40 conversation-continuity delivery? (evidence: doc/VIT-40-CONVERSATION-CONTINUITY.md; commit d6d123d7b)",
  "",
  "Finding: the engine already binds a durable session per thread (agentTaskSessions) and re-injects the thread transcript + context bundle as a Resume Delta every turn, with graceful fallback - all covered by existing claude-local-execute tests.",
  "",
  "Shipped this run (additive, token-gated, no engine/protocol changes): a subtle \"Resumed - N earlier messages\" marker at the run boundary so a reopened chat never resumes silently. 12 helper + 3 component tests green; IssueChatThread 72/72 unchanged; UI typecheck adds 0 errors.",
  "",
  "Remaining (I own, non-blocking): thread the marker into the virtualized renderer for very long chats.",
  "",
  "Accept = close VIT-40 (optionally capture a live before/after screenshot, a board/runtime action). Reject with a reason and I revise.",
].join("\n");
if (prompt.length > 1000) throw new Error(`prompt too long: ${prompt.length}`);
console.log("prompt length:", prompt.length);

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  idempotencyKey: `confirmation:${issue.id}:vit40-continuity-delivery:2026-07-16`,
  title: "VIT-40 continuity delivery - board review",
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    prompt,
    acceptLabel: "Accept - close VIT-40",
    rejectLabel: "Request changes",
    rejectRequiresReason: true,
    supersedeOnUserComment: true,
  },
});
console.log("interaction created:", interaction.id ?? JSON.stringify(interaction).slice(0, 200));

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log("status ->", patched.status);
