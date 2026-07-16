// One-off retry: VIT-51 confirmation interaction (with required payload) + in_review.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const ID = "c2c705e0-5e51-4a2b-94bb-d398ddb3a33a";
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
  title: "Approve the Summon desktop IA + sub-issue slate",
  continuationPolicy: "wake_assignee",
  idempotencyKey: `confirmation:${ID}:vit51:desktop-ia-v1`,
  payload: {
    version: 1,
    prompt:
      "Approve the proposed Summon desktop information architecture and the 8-sub-issue implementation slate (A-H), or request changes to specific panels.",
    acceptLabel: "Approve IA + file sub-issues",
    rejectLabel: "Request changes",
    detailsMarkdown:
      "Contact sheet: doc/design/evidence/VIT-51/contact-sheet-light.png and contact-sheet-dark.png (source contact-sheet.html, ?theme=dark). Full IA + slate: doc/design/VIT-51-DESKTOP-IA.md. Extracted from doc/research/DESKTOP-UX-SKELETONS.md. Slate: A Inbox surface, B Formation live board, C left-rail restructure, D agent-detail tabs, E composer anatomy, F tray + notification tiers, G command palette, H worktree console contract. Overlaps route to VIT-37/40/41/48 as adoption notes, not duplicates.",
  },
});
const status = await request("PATCH", `/issues/${ID}`, { status: "in_review" });
console.log(JSON.stringify({ interactionId: interaction?.id ?? null, status: status?.status }, null, 2));
