// One-off: VIT-51 — post IA-extraction progress, open the board contact-sheet
// confirmation, set in_review. Authors as the agent when PAPERCLIP_API_KEY is set.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";
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

// NOTE: forward slashes only in bodies — backslash paths 500 the comments API (VIT-66).
const COMMENT = `**Research doc landed — IA extracted, contact sheet ready for board review.**

The blocker cleared: \`doc/research/DESKTOP-UX-SKELETONS.md\` is in the repo. Per this issue's three steps:

**(1) IA extracted** to \`doc/design/VIT-51-DESKTOP-IA.md\` — left rail (7 stable slots, Inbox as home), main surfaces (Inbox decision queue, Formation live board, agent-detail tabs, one composer anatomy), Windows tray behavior (status-only, 3-class toasts), and the Ctrl+K verb set. Core thesis: adopt the incumbents' six-piece skeleton as table stakes; differentiate on persistent employees + a company-level decision queue + board-grade reporting.

**(2) Contact sheet for board review** (this confirmation):
- Light: \`doc/design/evidence/VIT-51/contact-sheet-light.png\`
- Dark: \`doc/design/evidence/VIT-51/contact-sheet-dark.png\`
- Source: \`contact-sheet.html\` (open in any browser; \`?theme=dark\` for dark)

**(3) Implementation sub-issues** — proposed slate of 8 (A: Inbox surface, B: Formation live board, C: left-rail restructure, D: agent-detail tabs, E: composer anatomy standard, F: tray + notification tiers, G: command palette, H: worktree console contract), filed only after this approval. Overlaps route as adoption notes to existing issues instead of duplicates: VIT-37 (composer placement + top-tier cost warning), VIT-40 (Summary default), VIT-41 (#company Dispatch channel + DM split), VIT-48 (ring/meters model).

Committed on \`vitals/vit-41-messages-inbox\` as \`25749cf7a\` (docs + evidence only; no product code changed).

**Board decision requested:** approve the IA + sub-issue slate as-is, or comment which panels/sub-issues to change. On approval I file the 8 sub-issues; on changes I revise the sheet.`;

async function main() {
  const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const issue = issues.find((c) => c.identifier === "VIT-51");
  if (!issue) throw new Error("VIT-51 not found");

  const comment = await request("POST", `/issues/${issue.id}/comments`, { body: COMMENT });
  let interaction = null;
  let statusUpdated = null;
  try {
    interaction = await request("POST", `/issues/${issue.id}/interactions`, {
      kind: "request_confirmation",
      title: "Approve the Summon desktop IA + sub-issue slate",
      body:
        "Review doc/design/evidence/VIT-51/contact-sheet-light.png (and -dark.png) plus doc/design/VIT-51-DESKTOP-IA.md. Confirm to approve the IA and the 8-sub-issue implementation slate (A-H); reject or comment to request changes to specific panels.",
      continuationPolicy: "wake_assignee",
      idempotencyKey: `confirmation:${issue.id}:vit51:desktop-ia-v1`,
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
