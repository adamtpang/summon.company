const API = "http://127.0.0.1:3100/api";
const ID = "fbe4104c-7bc4-4186-ac30-8d0c6504cda9";

const res = await fetch(`${API}/issues/${ID}/interactions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    kind: "request_confirmation",
    title: "Review the WhatsApp feel before merge",
    continuationPolicy: "wake_assignee",
    idempotencyKey: `confirmation:${ID}:vit41:messages-feel`,
    payload: {
      version: 1,
      prompt:
        "Draft Messages surface is ready on branch vitals/vit-41-messages-inbox (not pushed). Review the light + dark screenshots and the Product/Messages story, then confirm to approve merge.",
      acceptLabel: "Approve merge",
      rejectLabel: "Request changes",
      detailsMarkdown:
        "Evidence: doc/design/evidence/VIT-41/messages-light.png and messages-dark.png. Story: ui/storybook/stories/messages.stories.tsx (Product/Messages). Coordinates with VIT-40 (continuity) and VIT-57 (CEO front door) as one surface.",
    },
  }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 500));
