// One-off retry: VIT-61 confirmation interaction (with required payload envelope).
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const ID = "662d0aec-23b9-42a4-ab36-300d41e58737";
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

const interaction = await request("POST", `/issues/${ID}/interactions`, {
  kind: "request_confirmation",
  title: "Approve the Elon-operating-model UI (Algorithm gates, lanes, time-in-state)",
  continuationPolicy: "wake_assignee",
  idempotencyKey: `confirmation:${ID}:vit61:elon-ui-v1`,
  payload: {
    version: 1,
    prompt:
      "Approve the shipped Elon-operating-model UI: parallel lanes as the default tasks view, time-in-state age chips (24h/72h active, 7d/14d waiting), and the five-gate Algorithm strip with propose-deletion — or request changes.",
    acceptLabel: "Approve as shipped",
    rejectLabel: "Request changes",
    detailsMarkdown:
      "Contact sheet: doc/design/evidence/VIT-61/ — lanes-default, board-age-chips, list-age-chips, detail-VIT-61 (in-flight strip), detail-VIT-4 (done strip), lanes-mobile, each light + dark, captured from live Company Zero data. Design doc: doc/design/VIT-61-ELON-UI.md. Commit 9576ac925 on vitals/vit-41-messages-inbox. DECISION-SHEET section D (D1-D6 box-in-a-box dedup findings) remains open for separate board rulings.",
  },
});
console.log(JSON.stringify({ interactionId: interaction?.id ?? null }, null, 2));
