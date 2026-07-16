# Model Picker — "choose models like Claude Code" spec

Product goal (board, 2026-07-15): Summon is where you work on companies WITH Claude and
Codex under the hood, and the models must be modular and obvious — the /model experience
from Claude Code, applied to a company of agents.

## What already exists (do not rebuild)

- Adapters: `claude_local`, `codex_local`, `opencode_local` (+ future per CLAUDE.md:
  Cognition, Cursor, OpenClaw). Adapter registry in `ui/src/adapters/`.
- `AgentConfigForm.tsx`: adapter select, per-adapter model list
  (`agentsApi.adapterModels`), live detection (`agentsApi.detectModel`),
  reasoning-effort config, cheap model profile (`modelProfiles.cheap`).
- Doctrine (NORTH_STAR "fuel"): subscription-first — claude_local rides the Claude
  subscription login, codex_local rides the Codex subscription; instance API key is
  server-side fallback. $0 marginal cost is a product feature; the picker must show it.

The gap is SURFACE, not machinery: model choice is buried in a long agent-config form,
invisible at the moment of use, and has no company-level defaults.

Board refinement (2026-07-16): provider changes also need a company-wide "F1 tire
change." The board can refit the Claude/Codex fleet only while the vehicle is down;
the control plane, not the UI, enforces zero queued or running heartbeat runs.

## The four surfaces

1. **Model pit stop (Company Settings).** One guarded fleet control switches every
   existing `claude_local` / `codex_local` agent to the chosen provider's declared
   primary model and provider-matching cheap profile. It preserves company-owned
   workspace, environment, credential, instruction, prompt, timeout, and schedule
   configuration. Pending hires and non-Claude/Codex adapters remain unchanged. The
   server rejects the operation with `409` if any company heartbeat is queued or
   running, locks the affected agent rows, records per-agent config revisions, writes
   one company activity event, and never wakes work.
2. **Quick switch (the /model moment).** On AgentDetail header and the agent row's
   overflow menu: current model as a clickable chip → command-palette-style popover
   (provider group → model list → effort segment). Powered by the existing
   adapterModels/detectModel queries. One click, no form.
3. **Company defaults (Settings → Models).** Per-company: default adapter+model for new
   hires, per-ROLE overrides (e.g. Engineering = claude_local/opus-high, ops chores =
   cheap profile), and the cheap-profile definition itself. New-hire forms and bootstrap
   scripts read these defaults instead of hardcoding.
4. **Adapter health strip.** Same Settings page: each adapter with auth state (logged in
   as X / not authenticated), source badge (`subscription` / `API key` / `local CLI`),
   detected version, and a "detect" refresh. This is the modularity made visible —
   swapping executors is the product's provider-neutral promise (VIT-14 territory).

## Rules

- Provider-neutral naming everywhere ("executor: Claude (subscription)"), never
  hardcoded to one vendor. Chip shows `adapter · model · effort`.
- Changing a model NEVER interrupts an active run; it applies from the next run and
  says so inline.
- Company-wide provider changes are fail-closed: the action stays visible with an
  explicit disabled reason while work is queued/running, and the server repeats the
  guard inside the configuration transaction.
- Budget context in the picker: show the agent's monthly cap and spend next to the
  effort choice (spend hits the cap, not the bill).
- Additive files only; the picker is a new component family
  (`ui/src/components/model-picker/`), AgentConfigForm consumes it (its form section
  collapses to the same primitive).

## Acceptance

- From an agent's page: 2 clicks to change model or effort; change visible in the chip
  and in the next run's config.
- From Company Settings: when zero runs are active, 2 clicks refit the Claude/Codex
  fleet; while one run is queued or running, the same action is disabled and the API
  returns `409` without changing any agent.
- From Settings → Models: set a company default + one role override; hire a new agent;
  it inherits correctly.
- Adapter health strip reflects real CLI auth for claude_local and codex_local on this
  machine.
- Vitest coverage for the picker + defaults inheritance; stories (light+dark) join the
  visual suite.

## Suggested filing

Company Zero issue (VIT prefix), Engineering-owned, after Run 4 merges (the picker's
chips/popover should be born onto the converged primitives, not hand-rolled).
