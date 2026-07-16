# VIT-71 — CEO self-diagnosis autopilot

The CEO reads the company vitals on every heartbeat, surfaces problems as
starred tasks, and posts a board digest — without being asked. This is the
VIT-11 S4 diagnosis loop promoted into the CEO's standing heartbeat. The CTO
owns this wiring; the Vitals CEO operates it (see the CEO agent HEARTBEAT.md
section "2b. Vitals Self-Diagnosis").

## Surfaces

- `scripts/vitals-ceo-self-diagnosis.mjs` — self-contained runner against the
  live control plane (`http://127.0.0.1:3100`). No engine build or server
  change required, so it works on the packaged runtime that predates the
  VIT-14 cutover.
- `scripts/__tests__/vitals-ceo-self-diagnosis.test.mjs` — 17 tests over the
  pure rule engine and dedup planner (`node --test`).

## Vitals snapshot (per heartbeat)

| Vital | Live source |
| --- | --- |
| Spend + caps | `/costs/summary`, `/budgets/overview` (per-policy windows) |
| Revenue | `/costs/finance-summary` credits; active revenue goal from `/goals` |
| Task flow | `/issues` (open counts, per-issue `lastActivityAt`) |
| Quota headroom | `/costs/quota-windows` (VIT-48 data) |
| Staffing | `/agents` (role → department) |

## Anomaly rules (dumb + legible first, LLM judgment second)

Each firing carries the evidence numbers that justify it.

| Rule | Fires when | Proposed stars | Owner |
| --- | --- | --- | --- |
| `spend_pace` | budget utilization > 1.25x the elapsed window fraction (min $5 spend), or policy status not `ok` | high | CFO |
| `revenue_zero` | credits $0 while spend ≥ $20 | critical | CMO |
| `critical_stalled` | critical task with no activity > 72h | critical | task assignee |
| `quota` | window exhausted with > 12h to reset, or linear-burn forecast exhausts < 48h (mirrors VIT-48 math) | high | CTO |
| `dept_idle` | non-CEO agent with zero open assigned work | medium | CEO (staffing decision) |

The CEO reviews the dry-run and may adjust stars/owner with judgment before
`--file`; the rules are the floor, not the ceiling.

## Dedup (loop-until-dry)

The anomaly key travels in the task title as `[vitals:<key>]` — visible,
greppable, and the dedup identity.

- No matching issue → **file** (todo, starred, evidenced, goal-linked).
- Open matching issue → **comment** fresh evidence, throttled to once per 20h
  (comments wake assignees; the throttle keeps heartbeats from burning runs).
- Board-closed matching issue (`done`/`cancelled`) → **record and stop**;
  never re-file what the board closed.

A week of heartbeats therefore produces at most one task per distinct anomaly
key, plus throttled evidence updates.

## Safety

- Filing and surfacing only: no spend, no external sends. Filed tasks are
  `todo` — they do not launch runs by themselves.
- `--seed=spend-spike` injects a mock anomaly for acceptance testing and
  hard-refuses `--file`.
- Mutations use `PAPERCLIP_API_KEY` (authors as the CEO in its heartbeat) and
  propagate `PAPERCLIP_RUN_ID` as `X-Paperclip-Run-Id`.

## Acceptance evidence (2026-07-16)

- 17/17 rule-engine tests pass (`node --test`).
- Seeded spend spike → `spend_pace` (high, CFO) + `revenue_zero` (critical,
  CMO) detected; `--seed --file` refused.
- Live `--file` run filed two real anomalies: VIT-106 (Codex 5h quota
  exhausted, 137h to reset → CTO, high) and VIT-107 (Diagnostician has zero
  open work → CEO, medium), both goal-linked with evidence.
- Immediate re-run: both anomalies `skip_recent`, zero duplicates filed.

## Installed-runtime status (2026-07-16)

The live CEO timer is enabled at a 30-minute interval, and source timer tests prove
that an explicitly proactive generic timer wake invokes the adapter even when there
is no assigned issue. The installed Company Zero configuration is not yet an
accepted overnight loop, however: the CEO is currently `claude_local` while a stale
Codex cheap profile requests `gpt-5.5`, so recovery wakes fail before diagnosis.

`scripts/vitals-company-zero-bootstrap.mjs` now enforces provider-correct cheap
profiles (`claude-sonnet-4-6` for Claude, `gpt-5.5` for Codex) and puts the
self-diagnosis `--file` command directly in the CEO's `heartbeat_timer` instructions.
Apply that bootstrap only in a zero-active-run window. G7 reaches 100% only after
three mornings of useful evidenced work and a fresh CEO-filed task the board agrees
mattered; source wiring and the earlier VIT-106/VIT-107 filing proof are necessary
but not sufficient.
