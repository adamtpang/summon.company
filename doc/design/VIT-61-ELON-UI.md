# VIT-61 — The Elon operating model in the UI

Implements doc/research/ELON-OPERATING-MODEL.md §3 in the product. Everything is
derived from data tasks already carry — no schema changes, no new server state.

## 1. Algorithm strip (task detail)

`ui/src/components/AlgorithmStrip.tsx`, derivation in `ui/src/lib/algorithm-gates.ts`,
mounted in IssueDetail directly under the header block.

Five gates in order: **Requirements? → Delete? → Simplify → Accelerate → Automate.**
Gate states are pure functions of the task:

- **Requirements** — passed when the creator is named (`createdByAgentId` → agent
  name, `createdByUserId` → user label / "Board"); **attention** when nobody is
  recorded ("a requirement without a person is not a requirement").
- **Delete** — active while status is backlog/todo (still cheap to delete);
  passed once work starts ("survived deletion review") or when cancelled
  ("Deleted — the cheapest task is the one that doesn't exist"). While active,
  **Propose deletion** is a first-class action: it posts a structured comment
  (`buildDeletionProposalComment`) that the board approves by cancelling the task.
- **Simplify** — active while in_progress; passed at in_review/done.
- **Accelerate** — carries the time-in-state reading; escalates to **attention**
  when the age tier is aging/wrong ("if a timeline is long, it's wrong").
- **Automate** — pending until done ("automation comes last"); at done it asks
  "recurring? make it a routine."

## 2. Parallel lanes (default tasks view)

`ui/src/components/AgentLanesBoard.tsx`, wired as a third `viewMode: "lanes"` in
IssuesList; `pages/Issues.tsx` passes `defaultViewMode="lanes"` so lanes are the
default for fresh browsers (stored view preferences win).

- One lane per agent — **including idle agents** (an empty lane is information).
  Busiest lanes first; Unassigned last (amber — unowned work).
- Lane chips: status glyph, live pulse, identifier, title, priority, age chip.
- **True dependencies drawn as explicit SVG edges** between visible chips
  (`blockedBy`, now requested via `includeBlockedBy: true` on the tasks list
  fetch). Open blockers draw solid red ("active serialization"); resolved ones
  draw dashed muted. Edge tooltip: "X blocks Y — kill it if the dependency
  isn't real." A header line counts active dependencies: "serialization must
  justify itself."
- Terminal work (done/cancelled) is excluded — lanes show work in flight.
- Known bound: lanes read the paginated list data (100/page, updated-desc);
  very old open tasks beyond loaded pages don't lane until scrolled in.

## 3. Time-in-state everywhere

`ui/src/lib/issue-age.ts` + `ui/src/components/IssueAgeChip.tsx`, rendered in
IssueRow (list/inbox rows, desktop + mobile), KanbanBoard cards, and lane chips.

There is no `statusChangedAt`, so anchors are honest best-available:
in_progress → `startedAt`; in_review/blocked → `updatedAt` (lower bound — we
under-escalate, never over); waiting → `createdAt`. Tiers: active work goes
aging at 24h and **wrong** at 72h; waiting work at 7d/14d. Calm ages render as
quiet mono text; aging is an amber badge; wrong is a red badge with the render
rule in its tooltip.

## 4. Box-in-a-box audit

Filed as DECISION-SHEET section D (D1–D7): Inbox vs Decisions is the core
duplicated enclosure; Approvals + JoinRequestQueue are Inbox subsets; two
drifted settings navs; two "General" labels; three words for the one liveness
state; the self-contradictory agent `active` mapping. All PENDING board rulings.

## Verification

- 30 new tests (issue-age 12, algorithm-gates 8 — via 2 lib files; AlgorithmStrip 7;
  AgentLanesBoard 6) + affected suites (IssueRow, IssuesList, Issues, IssueDetail,
  Inbox) green; full ui typecheck + production build pass.
- Token gates: no new violations (all reported ones pre-date this change).
- Evidence: `doc/design/evidence/VIT-61/` — lanes default light/dark (real
  Company Zero data, 5 active dependency edges drawn), kanban + list with age
  chips, Algorithm strip on VIT-61 (in-flight) and VIT-4 (done), mobile lanes.
  Capture harness: `scripts/vit-61-elon-ui-evidence.mjs`.
