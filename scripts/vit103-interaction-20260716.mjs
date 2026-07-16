// Follow-up: create the board ratification card for VIT-103 (prompt <=1000 chars)
// and set status in_review. Comment already posted by the prior heartbeat script.
const BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";

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

const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
const issue = issues.find((i) => i.issueNumber === 103);
if (!issue) throw new Error("VIT-103 not found");

const prompt = [
  "Ratify the offer & ICP decision? (full card: doc/VIT-103-OFFER-ICP-DECISION-CARD.md)",
  "",
  "SELL: one hireable AI employee (owns an outcome end-to-end, board approves sends/spend) + a free whole-company diagnosis; company-context moat never sold.",
  "TO: solo technical founders first (self-serve); SMB owner-operators as higher-touch expansion (the Quantus service pattern). Strangers only.",
  "AT: $99/employee/mo, flat, no metering. Entry = ONE first employee at $99, NOT the $792 full formation. Land-and-expand grows seats.",
  "",
  "Why: $99 vs a $70K salary is a small obvious first check; free diagnosis earns the ask. Selling the whole formation up front loses to Cofounder.co ($20-50/mo for a whole company of agents). Price reversible; positioning sticky.",
  "",
  "Accept = ratify; I then update NORTH_STAR and close VIT-103. Reject with a reason (unit / lead ICP / price) and I revise.",
].join("\n");
if (prompt.length > 1000) throw new Error(`prompt too long: ${prompt.length}`);
console.log("prompt length:", prompt.length);

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  idempotencyKey: `confirmation:${issue.id}:offer-icp-decision-card:2026-07-16`,
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    prompt,
    acceptLabel: "Ratify - update NORTH_STAR",
    rejectLabel: "Request changes",
    rejectRequiresReason: true,
    supersedeOnUserComment: true,
  },
});
console.log("interaction created:", interaction.id ?? JSON.stringify(interaction).slice(0, 200));

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log("status ->", patched.status);
