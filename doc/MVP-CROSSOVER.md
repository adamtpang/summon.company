# The crossover: when Summon-on-Summon beats Claude-Code-on-Summon

Board ruling (2026-07-16): the Summon feedback loop is too disjointed vs Claude Code;
until the crossover, Summon gets perfected BY Claude Code, not by itself. This doc is
the gap analysis: where the company is vs the MVP bar where dogfooding wins.

## 1. Why Claude Code wins today (name the enemy precisely)

| Dimension | Claude Code (the bar) | Summon today |
|---|---|---|
| Loop latency | prompt → streaming work in seconds | comment → wake → minutes of silence |
| Visibility | every step streams inline | runs are opaque until evidence posts ("review silent active run" tickets exist) |
| Context | full session + memory files, never forgets mid-project | continuity in review (VIT-40), memory unbuilt (VIT-47) |
| Evidence | diffs/screenshots inline in the conversation | file paths in comments; board hunts |
| Ceremony | zero — just talk | issue → assign → wake → review chain |
| Decisions | inline yes/no in conversation | list UI, jargon cards (deck in build) |

## 2. Why Summon must win eventually (what Claude Code structurally cannot do)

1. **24/7 proactivity** — works while the board sleeps (heartbeat, VIT-44).
2. **True parallelism with accountability** — 8+ owned lanes at once, per-lane evidence.
3. **Institutional memory across companies** — Quantus context doesn't live in a chat scroll.
4. **Self-diagnosis** — surfaces problems the board never asked about (VIT-71).
5. **Governed spend/approvals** — an auditable company, not a terminal session.

The crossover is NOT parity on every row of table 1. It is: close the loop/trust gaps
ENOUGH that the five unique values net positive for a real week of work.

## 3. The seven gaps (state as of 2026-07-16)

| # | Gap | MVP bar | Tickets | Where we are |
|---|---|---|---|---|
| G1 | Prompt loop | Global composer; correct agent acks <10s; work STREAMS in the thread | VIT-57 (in_progress), VIT-41 (in_review) | ~75% in source / ~50% installed — composer now dispatches one assigned issue and opens its real live-run thread; packaged-desktop cutover and a measured <10s canary remain |
| G2 | Continuity | Reopen any thread days later; agent remembers; no re-briefing | VIT-40 (in_review), VIT-47 (in_progress) | ~80% in source / ~60% installed — per-thread Claude/Codex resume and fallback are implemented; resume markers now cover direct and virtualized threads; 48-hour packaged canary remains |
| G3 | Evidence inline | Screenshots/diffs render IN the thread; zero file-path hunting | VIT-41 steer (binding) | ~75% in source / ~40% installed — output media and Markdown/file evidence now render inside the Chat thread; packaged desktop and real-run proof remain |
| G4 | Decision friction | Tinder deck; reversible yes = one gesture | VIT-72 (in_progress, deck steer binding) | ~85% in source / ~50% installed — Decisions is graduated into nav and defaults to a one-card deck using the existing one-gesture actions; packaged canary + median decision-time proof remain |
| G5 | Reliability | No silent runs; quota walls = suspended-with-reset-time, never error black holes | VIT-53 DONE; VIT-64, VIT-48/49, watchdog VIT-74..77 | ~90% in source / ~45% installed — silent-run watchdog, quota windows, failover/failback, reset-time retries, and explicit `Quota suspended · resets …` issue copy are wired; the installed package predates the cure |
| G6 | One-glance state | Mission Control + Summon Score ordering | VIT-112, VIT-113 | ~75% in source / ~30% installed — Dashboard is now the five-zone Mission Control over real control-plane data; the queue is honestly labeled a two-factor proxy until money/time/effort/human-attention inputs are persisted |
| G7 | Unique value ON | Heartbeat executes real work nightly; CEO files useful tasks unprompted | VIT-44, VIT-71 | ~75% in source / ~25% installed — timer wakes enqueue real executable runs and the deduplicated CEO diagnosis runner has live filing evidence; source bootstrap now wires it into scheduled heartbeats and fixes cross-provider cheap profiles, but the live CEO is still failing on the old Claude+`gpt-5.5` mismatch |

## 4. The MVP crossover test (run it as a literal acceptance test)

One week where ALL of these hold:
1. Board prompts from the global composer; right agent acknowledges <10s; work
   streams visibly; result + evidence land in the SAME thread. (G1+G3)
2. Reopening any employee thread after 48h requires zero re-briefing. (G2)
3. Every decision arrives as a deck card; median decision <10 seconds. (G4)
4. Zero silent runs and zero error black holes all week; a quota wall shows
   "suspended, resets <t>". (G5)
5. Mission Control answers "state of the company?" in 10 seconds. (G6)
6. ≥3 mornings the board wakes to useful, evidenced overnight work + ≥1 CEO-filed
   task the board agrees mattered. (G7 — the reason to switch at all)
7. Tie-breaker: one identical real task run both ways (Summon vs Claude Code);
   Summon's total board-minutes consumed ≤ 2x Claude Code's, while running 5+
   other lanes in parallel.

When 1-7 hold, Summon-on-Summon wins and the board switches. Until then: Claude Code
drives, Summon executes what it's already good at (parallel bounded lanes).

## 5. Verified gap evidence: 2026-07-16

The binding constraint was not missing streaming machinery. It was a disconnected
front door:

- `GlobalComposer` and its routing brain existed but were mounted nowhere.
- Board Chat streamed a separate hard-coded Claude concierge process. That does not
  count as the assigned employee acknowledging or working.
- The real issue thread already merges active runs, live transcripts, comments,
  interactions, attachments, and work products into one conversation.

The source cure now mounts a persistent global composer in `Layout`, loads the
cross-company assignable roster, files one assigned issue, relies on the server's
single assignment wakeup, and opens the canonical issue thread. Paused and errored
employees produce explicit warnings; failed dispatch preserves the board's draft.

The evidence cure moves the existing output and attachment renderers into that same
thread before its composer. Promoted videos/images remain first-class output cards;
unpromoted screenshots, Markdown reports/diffs, PDFs, and other files render beside
the conversation instead of in a separate page section.

The Decisions cure graduates the attention surface out of Experimental settings and
defaults it to one expanded card at a time. J/K and previous/next move the card and
its inline action panel together; list mode remains available and persisted.

The reliability cure carries the scheduled run's persisted `errorFamily` into the
issue read model. Provider quota recovery is no longer a generic retry: it is shown
as `Quota suspended`, names the reset time, states that work resumes automatically,
and retains an explicit early-retry escape hatch. Existing model-chain failover,
failback, reset-time scheduling, liveness classification, and silent-run watchdog
surfaces were audited as connected production paths rather than isolated code.

The one-glance cure replaces the legacy metrics-and-charts Dashboard with Mission
Control: honest market-cap proxy, live execution/reliability, spend, Decisions,
one binding constraint, Demand/Capacity/Cash pressure, eight departments, eight
roadmap stages, and the top seven tasks. The task number remains explicitly a
two-factor proxy; calling it the full Summon Score before its other four inputs are
persisted would violate the 11x evidence rule.

The proactive-loop audit found that generic timer wakes do execute adapter work when
the employee opts into proactive heartbeats, and VIT-71 already has a deduplicated,
tested runner with prior live filing evidence. The live CEO timer is enabled every
30 minutes, but its installed configuration currently combines `claude_local` with
a stale Codex cheap profile (`gpt-5.5`). Source bootstrap now installs a Claude
Sonnet cheap lane for Claude and a GPT cheap lane for Codex, and tells timer wakes to
run the VIT-71 filing pass before choosing the next constraint.

Verification:

- 31 focused composer/routing/dispatch tests pass.
- 50 affected composer/layout/app tests pass.
- 122 Issue Detail/live-thread/output tests pass, including a direct assertion that
  screenshot and Markdown evidence are descendants of the Chat thread.
- 134 Decisions preference/action/sidebar/settings/deck tests pass.
- 30 shared quota/model-chain tests, 27 reliability UI tests, 12 scheduled-retry API
  tests, and the focused provider-quota scheduling proof pass.
- 27 Mission Control/routing/formation/roadmap/scoreboard tests and 14 market-cap
  model tests pass.
- UI, shared, and server TypeScript checks pass; the production UI build passes.
- The token gate reports 118 repository-wide pre-existing violations and zero in
  the files changed for this cure.
- Live desktop proof remains deliberately unclaimed: the installed packaged runtime
  predates this source work and the VIT-53 wake fix. Rollout remains gated by VIT-14's
  isolated migration-lineage canary and rollback plan.
- The final G7 test rerun and live bootstrap application were not performed after the
  local command-approval reviewer hit its execution-usage ceiling. Existing VIT-71
  documentation records 17/17 rule-engine tests and two previously filed live
  anomalies; neither substitutes for the required fresh overnight canary.

Next acceptance move: with zero queued/running runs, apply the provider-correct
Company Zero bootstrap (or the packaged Model Pit Stop once VIT-14 ships), then ship
the source through the VIT-14 cutover. Run one real desktop prompt and the 48-hour
continuity canary, measure decision time, and leave the CEO timer on for three
mornings. Only the resulting same-thread evidence raises G1–G7 to 100%.

## 6. Division of labor until crossover

- **Claude Code (the board's pair):** the deep seams agents are slow at — the
  packaged/source runtime seam (VIT-14, still the root of dev-loop pain), heartbeat
  execution (VIT-44 with CTO), Summon Score backend (VIT-113, small and gating
  Mission Control), Run 4 execution as a /goal worktree run, and PRE-VERIFYING the
  board's review queue (run the code, screenshot, one-line verdict) so board reviews
  take minutes.
- **Agents:** keep their current single S-tier lanes (VIT-57, 112, 48, 49, 114, 111;
  QUA-1/2) — bounded, parallel, evidence-gated.
- **Board:** clear the review queue (it gates G1/G2/G4 all at once); swipe the deck
  when it ships.

## 6. The 80/20 to 100% (board-ratified 2026-07-16)

Three moves close most of the remaining installed-gap; everything else is post-MVP.

1. **Review + merge the source stack.** The board reviews the seven in-review cures
   ON the live source UI (localhost:5173, real data), then the cofounder merges
   `vitals/vit-41-messages-inbox` (+132 dirty files, committed properly) to master.
   Unlocks: G1/G3/G4/G6 become the real surface.
2. **The packaged->source cutover (VIT-14).** Isolated-clone lineage proof -> backup
   -> canary -> cutover w/ rollback (board+cofounder op per the recovery rules).
   Unlocks: G2 resume, G5 quota states, G7 executing heartbeats - server-side cures.
3. **The control room.** VIT-125 kill switch + VIT-127 Manual/24-7 modes w/ token
   governor + VIT-126 CEO Surface/Triage/Route skills + VIT-113 score fields.
   Unlocks: the operating rhythm (Manual by day, governed 24/7 by night).

Then run the section-4 seven-day test. DEFERRED until after crossover: personas
polish (42/104), iOS (73), users lane (59), rebrand sweep (52), model-picker UI
beyond the pit stop, leaderboard (27), AI SDR (21/62), Run 4/5/6 execution beyond
what review requires. The core-8 + roadmap floor (VIT-114, extended to imports) and
kill switch ship WITH the MVP because control and defaults are the product.
