// One-off: post VIT-41 progress + set in_review + open a board-review confirmation.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const COMMENT = `**Messages surface shipped as a draft on branch \`vitals/vit-41-messages-inbox\` (not pushed — board reviews before merge).**

What landed (additive, no existing surface changed):
- New \`/messages\` route + sidebar nav ("Messages"). Employee rail: avatar, name, persona, presence dot, last-message preview, unread badge. Right pane: per-employee thread with chronological bubbles (you right / employee left), day dividers, timestamps, delivered/read ticks, running/typing indicator, jump-to-latest, and the shared \`ChatComposer\`.
- Presence dots reuse the shared \`--status-agent\` vocabulary (one status language). Read/delivered ticks and the typing indicator map to real run states.
- Split into a data container (\`Messages\`) + presentational \`MessagesView\` so it joins the Storybook visual suite (Product/Messages) in light + dark.

Coordination (one surface, not three): built as the single messaging home. Transcript is a local draft preview — the "remembers everything" continuity backend is **VIT-40**'s to wire, and the CEO front door (**VIT-57**) will point at this same surface. Presence + avatars are already live agent data.

Acceptance status:
- ✅ Pick an employee, send "status?", get a presence-aware reply in their thread with correct timestamps.
- ✅ Unread badges clear on read.
- ✅ Light + dark stories join the visual suite.
- ⏳ Board review of the WhatsApp feel before merge (confirmation opened below).

Evidence:
- Light: \`doc/design/evidence/VIT-41/messages-light.png\`
- Dark: \`doc/design/evidence/VIT-41/messages-dark.png\`
- Story: \`ui/storybook/stories/messages.stories.tsx\` (Product/Messages)

Verification: 8/8 Messages tests pass (presence mapping, presence-aware replies, day grouping, send→reply→read-receipt); UI typecheck exit 0; production build exit 0; token-gate clean for the new file (0 new violations).`;

async function main() {
  const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const issue = issues.find((c) => c.identifier === "VIT-41");
  if (!issue) throw new Error("VIT-41 not found");

  const comment = await request("POST", `/issues/${issue.id}/comments`, { body: COMMENT });
  let interaction = null;
  let statusUpdated = null;
  try {
    interaction = await request("POST", `/issues/${issue.id}/interactions`, {
      kind: "request_confirmation",
      title: "Review the WhatsApp feel before merge",
      body:
        "Draft Messages surface is ready on branch vitals/vit-41-messages-inbox. Please review the light + dark screenshots and the Product/Messages story, then confirm to approve merge (or comment changes).",
      continuationPolicy: "wake_assignee",
      idempotencyKey: `confirmation:${issue.id}:vit41:messages-feel`,
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
