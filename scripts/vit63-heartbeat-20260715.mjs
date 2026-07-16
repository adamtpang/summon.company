// One-shot heartbeat script for VIT-63 (2026-07-15, Vitals CMO):
// 1) comment durable progress + evidence, 2) create request_confirmation for the
// board (ImprovMX plan, DNS authorization, founder Gmail steps, publish gate),
// 3) set status in_review pending that confirmation (wake_assignee on accept).
const BASE = "http://127.0.0.1:3100/api";
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
const issue = issues.find((i) => i.issueNumber === 63);
if (!issue) throw new Error("VIT-63 not found");
console.log("VIT-63 id:", issue.id, "status:", issue.status);

const comment = [
  "[Vitals CMO - VIT-63 heartbeat 2026-07-15]",
  "",
  "Executed this heartbeat (evidence in repo working tree):",
  "",
  "1. DISCOVERY: DNS for both vitals.run and summon.company is on Vercel (ns1/ns2.vercel-dns.com); the local Vercel CLI is authenticated (adamtpang) and can manage records. NEITHER domain has MX records today - no existing mail to break. The board Gmail has no Summon/Users label (only 'Notes'). The connected Gmail MCP can read/search/draft/apply-labels but its scopes CANNOT create labels or filters (create_label returned 'insufficient authentication scopes') - those are 2-minute founder steps.",
  "",
  "2. PLAN + RUNBOOK written to doc/design/VIT-63-SUPPORT-INBOX.md: publish hello@summon.company (matches the visible Summon brand), configure hello@vitals.run identically; forwarding via ImprovMX free tier (Cloudflare rejected - would move nameservers off Vercel; Workspace rejected - paid overkill for zero inbound). Exact `vercel dns add` MX/SPF commands, Gmail filter spec, and end-to-end verification procedure are in the runbook.",
  "",
  "3. CONTACT POINT WIRED IN CODE: apps/landing/index.html footer now links mailto:hello@summon.company. NOT deployed - publishing is the board-approval gate per this issue's scope. Note: no waitlist form exists in the repo (CTAs are Stripe/cal.com), so the 'waitlist confirmation reply-to' has no wiring surface until a waitlist ships; recorded in the runbook.",
  "",
  "4. BOARD CONFIRMATION CARD created on this issue (wake_assignee). Accepting authorizes: (a) the hello@ address choice, (b) me running the DNS MX/SPF commands, (c) deploying the footer contact link. It also asks the board to do the two founder-only steps: create the free ImprovMX account with both domains + hello aliases (~5 min), and create the Gmail label Summon/Users + filter (~2 min).",
  "",
  "5. ON ACCEPTANCE I will: run the DNS commands, verify ImprovMX shows green for both domains, have a real test email sent to hello@summon.company and hello@vitals.run, and verify via Gmail search that both land under Summon/Users - then close this issue with that evidence (which gives VIT-59's acceptance test a live channel).",
  "",
  "DISPOSITION: in_review - pending the request_confirmation card on this issue (continuationPolicy wake_assignee resumes me on acceptance).",
].join("\n");

await request("POST", `/issues/${issue.id}/comments`, { body: comment });
console.log("comment posted");

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  idempotencyKey: `confirmation:${issue.id}:vit63-support-inbox-runbook:2026-07-15`,
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    prompt: [
      "Approve the VIT-63 support inbox plan (runbook: doc/design/VIT-63-SUPPORT-INBOX.md)?",
      "",
      "Accepting authorizes the CMO to: (1) add ImprovMX MX + SPF DNS records to summon.company and vitals.run via the authenticated Vercel CLI, (2) deploy the landing footer with mailto:hello@summon.company.",
      "",
      "Founder steps needed before/with acceptance (~7 min total):",
      "- Create a free ImprovMX account, add both domains, alias hello -> adamtpangelinan@gmail.com on each.",
      "- In Gmail: create label Summon/Users and a filter to:(hello@summon.company OR hello@vitals.run) -> apply that label, never spam.",
      "",
      "On acceptance the CMO runs DNS, verifies a real test email lands under Summon/Users end-to-end, and closes VIT-63.",
    ].join("\n"),
    acceptLabel: "Approve plan + authorize DNS & publish",
    rejectLabel: "Request changes",
    rejectRequiresReason: true,
    supersedeOnUserComment: true,
  },
});
console.log("interaction created:", interaction.id ?? JSON.stringify(interaction).slice(0, 200));

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log("VIT-63 patched:", patched.status);
