// One-off: VIT-115 heartbeat disposition — acknowledge BEST-DASHBOARDS.md as binding
// spec, deliver the via-negativa slate (inventory + sentences + before evidence),
// request board approval of the slate as ONE decision card, move to in_review.
// Idempotent via interaction idempotencyKey.
const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
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
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const issues = await request("GET", `/companies/${process.env.PAPERCLIP_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310"}/issues`);
const issue = issues.find((i) => i.identifier === "VIT-115");
if (!issue) throw new Error("VIT-115 not found");

const comment = await request("POST", `/issues/${issue.id}/comments`, {
  body: [
    "Research acknowledged: doc/research/BEST-DASHBOARDS.md read in full and used as the binding spec — the three-surface target (Dashboard / Chat / Decisions + Settings), gates G1-G12, and the section-3 deletion table drove every sentence below.",
    "",
    "**The slate is ready: DELETE 24 / DEMOTE 26 / KEEP 9** (commit ae39c5fab on vitals/vit-41-messages-inbox).",
    "",
    "- Full inventory, one sentenced row per route/nav-item/dialog/panel: doc/design/VIT-115-RUN6-INVENTORY.md",
    "- Judgment calls recorded: DECISION-SHEET.md section R6 (R6-1..R6-7)",
    "- Before-screenshots of all 24 slated surfaces (live Company Zero data): doc/design/evidence/VIT-115/before/ (27 shots; kept surfaces also in dark)",
    "",
    "Two inventory findings that correct assumptions: (1) there is NO drag-and-drop pane dashboard in ui/src — that spec row targets the Electron shell, out of this run's scope; (2) four UxLab pages are already orphaned dead code (no route mounts them) — instant deletes.",
    "",
    "Guardrails honored: Inbox + Approvals are DEMOTED not deleted (active wake loop + VIT-45 approval gate; hard delete waits for VIT-111). AI SDR demoted (active VIT-103 sales dogfood). Zero protocol/API/DB changes. Timeline + UX labs are upstream-owned code — deleting them accepts permanent fork divergence, flagged as riskiest-list items.",
    "",
    "Bias check against the 10% add-back rule: the slate deletes the ENTIRE sidebar (three tabs + top bar replace it), both dogfood pages we shipped this month (Formation, Roadmap - they become dashboard zones), and all money pages (Costs/Usage fold into Zone A + level-2 drills). If nothing gets added back in two weeks, I re-run harder per the issue's DONE-WHEN.",
    "",
    "Confirmation card below. Execution happens in worktree design/run6-via-negativa, one deletion unit per commit, zone-dependent deletes land WITH their absorbing zone (never before), suite + token gates green.",
  ].join("\n"),
});

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  title: "Approve the Run-6 via-negativa slate: DELETE 24 / DEMOTE 26 / KEEP 9",
  continuationPolicy: "wake_assignee",
  idempotencyKey: `confirmation:${issue.id}:run6-slate:v1`,
  payload: {
    version: 1,
    prompt:
      "Approve the via-negativa slate: the app collapses to three tabs (Dashboard / Chat / Decisions) + Settings + command palette. DELETE 24 units (whole sidebar, Formation/Roadmap/Org/Costs/Usage/Activity/Timeline pages, Dashboard-Live, Companies, UX labs, dead code), DEMOTE 26 to one hop deep (palette or level-2 drill), KEEP 9. Reply with any per-item overrides from the top-10 riskiest list before accepting, or accept as-is.",
    acceptLabel: "Approve slate — start deleting",
    rejectLabel: "Request changes",
    detailsMarkdown: [
      "**Top-10 riskiest deletions — veto any individually in a comment, then accept:**",
      "",
      "1. **Sidebar entirely** -> three tabs + slim top bar (company switcher + account menu + Decision badge). Every muscle-memory path changes.",
      "2. **Formation page** -> dashboard Zone B (shipped this month; becomes a zone, not a page).",
      "3. **Roadmap page** -> dashboard Zone C (same).",
      "4. **Costs page** -> Zone A pressure bars + per-agent spend in agent-detail drill. Lands only WITH Zone A (G9: decision-critical numbers stay visible).",
      "5. **Usage page** -> same fold; quota alerts become formation-card badges.",
      "6. **Activity page** -> 'while you were gone' recap strip.",
      "7. **Timeline page** -> deleted; upstream-owned code, permanent fork divergence accepted.",
      "8. **Org page** -> Zone B covers; the classic tree view is gone.",
      "9. **Dashboard/Live page** -> VIT-112 formation live mode absorbs it.",
      "10. **Companies page** -> company-switcher dropdown covers select/create/reorder.",
      "",
      "Full slate: doc/design/VIT-115-RUN6-INVENTORY.md - Before evidence: doc/design/evidence/VIT-115/before/ - Judgment calls: DECISION-SHEET.md R6. Commit ae39c5fab.",
      "",
      "On acceptance: execution in worktree design/run6-via-negativa, one deletion per commit, dead code first, zone-dependent folds ride with the dashboard rebuild, sidebar swap last behind a canary flag.",
    ].join("\n"),
  },
});

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log(JSON.stringify({
  issue: issue.identifier,
  commentId: comment?.id ?? null,
  interactionId: interaction?.id ?? null,
  status: patched?.status ?? null,
}, null, 2));
