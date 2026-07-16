# VIT-49 — Fallback model chains (auto-failover, auto-reprobe, board-notified)

**Why:** On 2026-07-15 the Codex weekly quota wall took 5 of 8 employees dark until
Jul 22; the only fix was manual adapter surgery. This makes that policy, not surgery.
Design reference: `doc/research/OPENCLAW-LEARNINGS.md` §2.4 (ordered fallbacks with
auto-reprobe of the primary).

## Config

Per employee, in `agent.runtimeConfig.modelChain` (validated by
`agentRuntimeConfigSchema`, editable via `PATCH /api/agents/{id}`):

```json
{
  "modelChain": {
    "fallbacks": [
      { "adapterType": "claude_local", "adapterConfig": { "model": "claude-fable-5" } },
      { "adapterType": "claude_local", "adapterConfig": { "model": "claude-haiku-4-5-20251001" } }
    ],
    "pinned": false
  }
}
```

- **Primary is implicit**: the agent's own `adapterType` + `adapterConfig`. Fallbacks
  are ordered; entry config supplies the provider-specific keys (`model`, effort);
  adapter-agnostic keys (`env`, `cwd`, `paperclipSkillSync`, …) are inherited from the
  primary config — the same keys-survive-adapter-swap rule the agents PATCH route uses.
- **Company default**: `instanceSettings.general.modelChainDefaults[companyId]`
  (migration-free). An agent-level chain overrides it.
- **Pin (governance)**: `pinned: true` — the board pins an employee to its primary for
  sensitive work; pinned employees never fail over, even when the primary is down.

## Semantics

Resolution happens once per run, at the launch seam in `executeRun`
(`server/src/services/heartbeat.ts`): the run's *effective agent* is computed by
`resolveAgentModelFailoverForRun` (`server/src/services/model-failover.ts`), and every
downstream surface (adapter selection, session config, config resolution, cost
attribution) flows from it.

- **Health source**: the VIT-48 quota snapshot (`peekQuotaWindows`, 5-min
  stale-while-revalidate cache). No second quota poller.
- **Triggers (only)**: `quota_exhausted` (any provider window at 100%),
  `auth_failure` / `provider_outage` (classified from the quota probe error;
  unclassifiable errors do NOT trigger), `cost_limit` (structured input). Content
  refusals are structurally excluded — `FAILOVER_TRIGGERS` has no refusal member and
  the classifier returns "available" for refusal-shaped text; refusals route to the
  board, never to a different model.
- **Auto-reprobe / failback**: every run start re-walks the chain from the primary
  down and takes the first available entry. When the primary's window resets, the next
  run lands back on it automatically (`agent.model_failback` event).
- **Shifts**: `failover` (event + notification), `hold` (same fallback as last run, no
  duplicate event), `failback` (event + notification), `pinned_unavailable` and
  `exhausted_no_fallback` (event once per blocked window, deduped).
- **State**: `agent.metadata.modelFailover` (`activeIndex`, `trigger`, `since`,
  `resetsAt`). Run context carries `paperclipModelFailover` so run logs show the switch.
- **Safety**: the resolver never throws into the launch path — any internal failure
  logs a warning and runs on the primary unchanged.

## Governance events + board notification

Every shift writes an `activity_log` row (`agent.model_failover`,
`agent.model_failback`, `agent.model_fallback_unavailable`) with the human sentence
("Vitals Engineer fell back to Claude (claude_local): Codex 1w quota exhausted, resets
Jul 22"). The board attention feed (`server/src/services/attention.ts`) surfaces each
event as a `budget_alert` item (last 7 days, dismissable, links to `/usage`).

## VIT-64 boundary

VIT-49 owns "try the next model"; VIT-64 owns the terminal quota-suspended state.
VIT-64 consults `consultModelChainFallbackPolicy()` FIRST; only when
`hasFallbackAvailable === false` (pinned, or every entry blocked) does it suspend,
using the returned `resetsAt` (earliest known reset) as the retry timestamp. Agents
with no chain configured keep the status quo — no failover, no new events.

## Verification (2026-07-16)

- `packages/shared/src/model-chain.test.ts` — 16 tests: the Jul-15 incident as
  regression (down-shift to Claude with "resets Jul 22" message, hold, up-shift on
  reset), pin governance, trigger classification (refusals never classify), no-blind
  failover, merge semantics, config/state readers.
- `server/src/__tests__/model-failover.test.ts` — 9 tests: the incident end-to-end at
  the run seam (event + persisted state + merged adapterConfig), hold dedup, failback
  clears state, pin + unavailable dedup, company-default chain, chainless status quo,
  never-throws safety, both VIT-64 hook answers.
- Full shared suite 303 passed; server `attention-service` + `heartbeat-model-profile`
  + `model-failover` 20 passed; server + shared typechecks clean.

## Rollout

Source-only until the VIT-14 packaged-runtime cutover (same as VIT-53): the live
packaged control plane predates this code. No DB migration required (chain lives in
existing jsonb columns; company default in instance settings jsonb).
