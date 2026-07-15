# VIT-51 — Summon Desktop Information Architecture (proposed, for board review)

**Source:** `doc/research/DESKTOP-UX-SKELETONS.md` (board-run research, 2026-07-15).
**Status:** PROPOSED — awaiting board confirmation on the contact sheet before
implementation sub-issues are filed.
**Contact sheet:** `doc/design/evidence/VIT-51/contact-sheet-light.png` /
`contact-sheet-dark.png` (source: `contact-sheet.html`).

## The one-sentence thesis

Claude Desktop and Codex converged on the same six-piece skeleton (status sidebar,
composer-adjacent controls, usage rings/meters, worktree isolation, notify-only-when-
blocked, diff-centric review); Summon adopts all six as table stakes and differentiates
one level up: **persistent employees with roles, a company-level decision queue (Inbox),
and board-grade reporting.** The human is the board, not the driver.

## 1. Left rail (spatially stable forever — never relocate sections once shipped)

| # | Slot | What it is | State today |
|---|---|---|---|
| 0 | Company switcher | Icon rail slot per company, Ctrl+1..9 | New (future multi-venture) |
| 1 | 📥 **Inbox** | The decision queue. Badge = pending decisions. **App home.** | New surface |
| 2 | 🏢 **Formation** | Live employee board: presence dot, current issue, activity line, usage ring | Exists (static) → upgrade |
| 3 | 🗺️ **Roadmap** | Issue board; cards gain diff-stat chips + run-state badges | Exists → additive |
| 4 | 💬 **Threads** | #company Dispatch channel pinned + per-employee DMs | VIT-41 (in review) |
| 5 | 💰 **Costs** | Company meters + per-employee breakdown vs $99/employee | VIT-48 shipped → extend |
| 6 | ⚙️ **Customize** | Adapter health, role/permission templates, skills roster, notification tiers | Partial → consolidate |

## 2. Main surfaces

- **Inbox (home):** two-pane, never navigates away. Left: queue (approvals, completed
  runs, questions, quota events), `j/k` to move. Right: focused item detail = the
  existing issue chat thread in **Summary** density, diff chip → diff viewer with
  click-line-to-comment → resubmit to the employee. One-key verbs: `1` approve,
  `2` request changes, `3` reject, `h` snooze, `e` archive. Header shows queue depth +
  avg time-to-decision; over threshold → "run fewer employees" (WIP limit on the company).
  Empty state is a win state: "All employees unblocked — nothing needs you."
- **Formation:** kanban of employee cards by state (Working / Blocked on you / Idle /
  Resting-at-quota). Card = avatar + state dot + current issue + live activity line +
  usage ring. Click → agent detail. Signature screen: a company, not a terminal mux.
- **Agent detail:** tabs — *Thread* (density toggle Normal/Verbose/Summary, Ctrl+O —
  VIT-40) · *Activity* (run log, worktrees, promote-to-branch) · *Trust* (permission
  profile + accumulated "always allowed" grants, revocable) · *Usage* (spend by
  issue/tool/model) · *Config* (default model + effort — VIT-37, adapter, role).
- **Composer (one anatomy everywhere):** input, then adjacent to send:
  **model picker · effort selector · permission mode · usage ring** — all switchable
  mid-run. Max tier shows projected cost against remaining quota before applying.
- **Files as truth:** employee memory/logs/deliverables stay plain files in the repo
  (Obsidian "file over app") — market as a trust feature.

## 3. Tray behavior (Windows-first)

- Close hides to tray; employees keep running; launch on login.
- Tray color = aggregate state: **green** all working/idle · **amber** decisions waiting
  (count in tooltip) · **red** employee blocked or adapter down. Left-click → Inbox.
- Tray is status, not commands (Microsoft guidance) — no critical-action context menu.
- Toast taxonomy (Codex three-class): *needs permission* / *has a question* interrupt;
  *run completed* badges only; daily digest = card deck with approve/dismiss per card.

## 4. Command palette (Ctrl+K)

Focus in input on open · fuzzy match · digits+Enter · every row teaches its shortcut.

`go` (inbox/formation/roadmap/costs/[employee]; g-chords outside palette) · `assign VIT-52
to Riley` · `summon designer` · `pause/resume [all|employee]` · `approve/reject next`
(drains Inbox head) · `message Riley: …` · `set model / set effort` (VIT-37) ·
`set trust` · `usage this week / usage Riley` · `snooze until …` (returns on date OR
activity) · `switch company`.

Global keys: `Ctrl+K` palette · `j/k` lists · `1/2/3/h/e` Inbox verbs · `Ctrl+O` density
· `Ctrl+Tab` cycle surfaces · `Esc` stop focused employee's turn.

## 5. Rules adopted from the anti-pattern research

1. **No invisible autonomy** — every action attributable to a visible run; merge/publish/
   spend always lands in the Inbox first (Height 2.0 lesson).
2. **Interrupt only when blocked on human input** — everything else badges or digests;
   DND escalation rate-limited (Slack tiers).
3. **Bounded approval queue** — show depth + drain rate; suggest pausing hiring over
   threshold.
4. **Console never waits on the network** — cache console state locally, stream agent
   events in background; no spinners.
5. **No IDE cosplay** — fixed three-region layout, Summary transcripts by default,
   terminals/diffs one level down inside agent detail.

## 6. Proposed implementation sub-issues (filed only after board approval)

One per approved surface change; overlaps route to existing issues instead of duplicates.

| # | Sub-issue | Scope | Depends on / overlaps |
|---|---|---|---|
| A | **Inbox surface** (decision queue, two-pane, one-key verbs, drain-rate header, win-state empty) | New route + left-rail slot 1; reuses issue-thread component as right pane | VIT-41 thread component |
| B | **Formation live board** (presence dots, activity line, usage ring, state grouping) | Upgrade existing formation view | VIT-48 usage data |
| C | **Left-rail restructure** (7 slots above, badges, spatial stability contract) | Nav shell change | A (Inbox exists) |
| D | **Agent detail tabs** (Thread/Activity/Trust/Usage/Config; permission-as-trust-attribute with revocable grants panel) | Upgrade agent detail | VIT-37 (Config), VIT-40 (Thread density) |
| E | **Composer anatomy standard** (model · effort · permission · usage ring adjacent to send, everywhere) | Shared composer component | VIT-37 lands inside this anatomy |
| F | **Tray + notification tiers** (state-colored tray, three-class toasts, daily digest deck) | apps/desktop main.js + renderer | — |
| G | **Command palette** (Ctrl+K, verb set §4, g-chords, global keys) | New global component | A–D for verb targets |
| H | **Worktree console contract** (worktree shown per run, diff-stat chips on issue cards, promote-to-branch as Inbox item) | Roadmap cards + agent detail Activity + Inbox item type | A |

Adoption notes routed to existing issues (no new sub-issue): VIT-37 gets the
composer-adjacent placement + top-tier cost warning; VIT-40 gets Summary-as-default +
density-is-a-render-filter; VIT-41 gets the #company Dispatch-router channel + DM split;
VIT-48/usage gets the three-level ring/meters model + let-the-turn-finish wall behavior.
