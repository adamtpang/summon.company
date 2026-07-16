// One-shot heartbeat script for VIT-63 (2026-07-16, Vitals CMO), run after the
// board ACCEPTED confirmation card b8b74a82. Evidence comment already posted
// (4e0ab946). This creates the ask_user_questions card for the two founder-only
// steps + test email (wake_assignee) and reports issue status.
const BASE = "http://127.0.0.1:3100/api";
const ISSUE_ID = "0a08a9f0-1889-41a5-8540-eae7454364af";
const KEY = process.env.PAPERCLIP_API_KEY;

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

const interaction = await request("POST", `/issues/${ISSUE_ID}/interactions`, {
  kind: "ask_user_questions",
  idempotencyKey: `questions:${ISSUE_ID}:vit63-founder-steps:2026-07-16`,
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    title: "VIT-63: two founder steps left, then I verify and close",
    supersedeOnUserComment: true,
    questions: [
      {
        id: "improvmx_done",
        prompt:
          "ImprovMX (~5 min, founder-only): create the free improvmx.com account, add BOTH domains (summon.company + vitals.run), alias hello -> adamtpangelinan@gmail.com on each. DNS MX/SPF is already live, so ImprovMX should show green checks immediately. Status?",
        selectionMode: "single",
        required: true,
        options: [
          { id: "both", label: "Done for both domains" },
          { id: "one", label: "Done for one domain" },
          { id: "not_yet", label: "Not yet - will do" },
          { id: "help", label: "Need help / something failed" },
        ],
      },
      {
        id: "gmail_label_done",
        prompt:
          "Gmail (~2 min, founder-only): create label Summon/Users and a filter to:(hello@summon.company OR hello@vitals.run) -> apply label, never spam. (Connected Gmail scopes cannot create labels/filters.) Status?",
        selectionMode: "single",
        required: true,
        options: [
          { id: "done", label: "Done" },
          { id: "not_yet", label: "Not yet - will do" },
          { id: "help", label: "Need help" },
        ],
      },
      {
        id: "test_email",
        prompt:
          "End-to-end test: once ImprovMX is set up, send one email from ANY outside account to hello@summon.company. On my next wake I verify via Gmail search that it arrived under Summon/Users, then close VIT-63 (giving VIT-59 its live channel). Status?",
        selectionMode: "single",
        required: true,
        options: [
          { id: "sent", label: "Sent - go verify" },
          { id: "later", label: "Will send after ImprovMX setup" },
          { id: "skip", label: "Verify without a test email" },
        ],
      },
    ],
  },
});
console.log("interaction created:", interaction?.id ?? JSON.stringify(interaction).slice(0, 200));

const issue = await request("GET", `/issues/${ISSUE_ID}`);
console.log("VIT-63 status:", issue?.status);
