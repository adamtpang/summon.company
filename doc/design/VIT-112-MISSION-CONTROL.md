# VIT-112 — Mission Control: the one-screen master dashboard

Status: **full-screen proposal awaiting board confirmation**. The binding layout
source is `doc/research/BEST-DASHBOARDS.md` (landed 2026-07-16) — its §3 five-zone
layout and §2 gates G1–G12 govern every decision below. The LIVE AGENT RUNS zone
(board addition, comment `a0b27fde`) is spec'd below as the formation zone's live mode.

Owner: Vitals Design Director. Board decisions recorded inline.

---

## Zone ledger (gate G4: max 5 zones)

| # | Zone | Source ticket | Status |
|---|------|--------------|--------|
| A | Vitals strip (EKG hero top-left + Market Cap + MRR + Runway; WYWG strip on first open) | VIT-101 | proposed on contact sheet |
| B | Formation (8 departments) — **with LIVE AGENT RUNS as its live mode** | VIT-112 + board addition | proposed on contact sheet |
| C | Roadmap (8 stage bars, constraint outlined) | VIT-13 mechanics | proposed on contact sheet |
| D | Task queue (top 7 by Summon Score) | companion ticket | proposed on contact sheet |
| E | Decision badge (single primary action, fixed top-right) | VIT-72 | proposed on contact sheet |

## Layout decisions taken with the research as binding (2026-07-16)

1. **CEO is not a ninth formation card.** Research §3 draws the formation as the 8
   departments. The CEO is the founder's counterpart in Chat (the FM "assistant
   manager"), and CEO-mediated items surface through the Decision badge. The
   nine-archetype mapping below survives for the fleet strip counts only.
2. **Runway hero ships as a visible G10-blank.** No cost ledger exists, so the slot
   renders "No cost ledger yet — G10 blanks this slot until VIT-46 wires real spend"
   instead of a number. The gate is enforced in public, not silently.
3. **Task-queue stars = issue priority until the Summon Score ships.** Both are logged
   fields, so the interim mapping (critical=4★, high=3★, …) passes G10; invented
   decimal scores would not. The queue caption states the mapping.
4. **Honest flatline.** The EKG renders 0 revenue events as a flat line and the
   green-day ring open. Pre-revenue truth is the whole point of the 11x rule.
5. **Stage % comes from the existing Roadmap evidence engine**
   (`ui/src/pages/Roadmap.tsx` — stage definitions + `ISSUE_STATUS_PROGRESS`
   weights + `selectRoadmapConstraint`). The contact sheet's stage percentages are
   illustrative until Zone C is wired to that engine; every other number on the
   sheet is from the live API snapshot (04:52Z).
6. **Fixed spatial hierarchy** (research idea #5): grid areas `wywg / vitals /
   formation+roadmap / queue`, never user-rearranged. The 8-pane drag-and-drop
   layout is recorded for deletion in the research §3 delete table.

**Placement decision (Design Director):** the board offered two placements for LIVE
AGENT RUNS — a standalone zone or the formation zone's live mode. It is the formation
zone's live mode. Rationale: the formation card grid IS the roster of who can work;
"who is working right now" is a state of that same roster, not a second roster. A
standalone zone would duplicate the eight department cards (Elon gate 2: delete it).
Zone count stays 5 of 7.

---

## LIVE AGENT RUNS — zone spec

**One glance answers:** who is working right now, on what, for how long, and where
the idle capacity is. The StarCraft minimap.

### Two scopes

1. **Per company (Mission Control, formation zone):** each department card carries a
   live layer — pulse dot + current task one-liner + running duration when its agent
   has a live run; dimmed "idle" treatment when staffed but not running.
2. **Fleet (sidebar, all companies):** a compact strip per company in the existing
   sidebar company list: `● 3 running` with archetype initials of the active agents
   (e.g. `E D S`). Click = that company's Mission Control. No new top-level surface.

### Archetype grouping

Nine archetypes: **CEO + the eight departments** (Engineering, Design, Sales,
Marketing, Finance, Operations, Support, Legal). Mapping reuses the existing
`departmentMatchScore` in `ui/src/pages/Formation.tsx` (metadata.department →
aliases in title/name/capabilities → `role` fallback); CEO is matched by
`role === "ceo"` before department scoring. No new taxonomy is invented — the
formation and the live-runs view MUST agree on who belongs to which department.

### Card anatomy (per department, live mode)

- **Pulse dot:** `running` = solid dot with a slow 2s pulse; `queued` = hollow dot,
  no pulse; no live run = no dot, card dims to idle treatment.
- **Task one-liner:** the issue title for the run's `issueId`, truncated to one line.
  Falls back to `currentStatusMessage` ("Receiving agent output") when the run has
  no issue context.
- **Duration:** live elapsed timer from `startedAt` (`12m`, `1h 04m`). Queued runs
  show `queued` — never a fake timer (`startedAt` is null until the process starts).
- **Stuck signal:** when `outputSilence.level` crosses `suspicious`, the dot turns
  amber and duration gains "silent {n}m". This is the only warning state; thresholds
  come from the server (1h suspicious / 4h critical), never invented client-side.

### Idle capacity

Departments staffed but with zero live runs render dimmed with the label `idle` —
idle capacity is information the board acts on, so it is visible, not hidden.
Unstaffed departments keep the existing "staff this department" treatment.

### Click paths

- Department card → that employee's chat thread (unchanged from formation spec).
- Task one-liner → the issue thread.
- Fleet strip row → that company's Mission Control.

### Data contract (verified against the live control plane, 2026-07-16)

- `GET /companies/:id/live-runs` — returns queued+running heartbeat runs with
  `status`, `startedAt`, `createdAt`, `agentId`, `agentName`, `issueId`,
  `currentStatusMessage`, `currentToolName`, `outputSilence{level, silenceAgeMs}`.
  **Gotcha:** never pass `minCount` — it pads with historical runs and renders bogus
  "live" counts (see comment at `server/src/routes/agents.ts:3645`).
- Task one-liner: resolve `issueId` against the company issues list already in the
  UI cache; per-issue fetch only on cache miss.
- Fleet scope v1: client fan-out of `live-runs` across the sidebar's company list
  (company count is single digits), polling every 10s. If fan-out ever hurts, the
  follow-up is one additive `GET /instance/live-runs` endpoint — not v1 scope.
- Agent→archetype: `GET /companies/:id/agents` (`role`, `title`, `metadata`) through
  the existing Formation mapping.

### Gates compliance

- **Daily-action test:** the board redirects idle capacity and unsticks silent runs
  daily — this zone is the trigger for both. Passes.
- **Real data only:** every rendered field above is a runtime-logged column verified
  live on 2026-07-16 (Vitals CEO `running` on a real issue, Vitals CTO `queued`).
- **No fake urgency:** timers are real elapsed time; pulse animates only for
  genuinely running processes; no decorative XP, no red states except server-defined
  silence thresholds.
- **States covered:** zero live runs renders calm — "All quiet — N agents standing
  by", never an error or empty-scary state. Paused/terminated agents are excluded.
  Terminal issues never appear as live work (VIT-53 wake semantics).

### Evidence

- **Full one-screen contact sheet** (light + dark, five zones, real Company Zero
  snapshot 2026-07-16 04:52Z):
  `doc/design/vit-112-mission-control-contact-sheet.html` and
  `doc/design/vit-112-mission-control-contact-sheet.png`.
- Live-runs zone contact sheet (earlier iteration):
  `doc/design/vit-112-live-runs-contact-sheet.html` and
  `doc/design/vit-112-live-runs-contact-sheet.png`.

Snapshot data on the full sheet, all API-verified: 3 running runs (Design Director
on VIT-112 3m, Engineer on VIT-57 9m, CTO on VIT-43 14m), 47 queued (CTO 34,
Engineer 11, DD 2), 8 staffed roles / 3 unstaffed departments, 41 open + 18 done
issues, market cap "option value / first-$99 lever" from `doc/MARKET-CAP-MODEL.md`.

---

## Remaining (sequenced)

1. ~~`doc/research/BEST-DASHBOARDS.md` lands~~ → done, layout reconciled above.
2. ~~Full-screen contact sheet, light + dark, board gallery, BEFORE build.~~ → done.
3. **Board confirmation of the contact sheet** → build → Company Zero + Quantus
   render with real data.
4. DECISION-SHEET entries for every absorbed/deleted surface (research §3 delete
   table is the source list).
