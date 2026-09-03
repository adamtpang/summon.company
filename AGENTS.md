<!-- BEGIN:imported-codex-context -->
# summon.company cross-agent handoff

Last updated: 2026-08-01 by Claude (board handoff below). Prior: 2026-07-14 by Codex.

## BOARD HANDOFF 2026-08-01: summon work lives HERE now

Adam's ruling: Aether root sessions handle portfolio only; ALL summon execution
happens in summon.company sessions and the kitchen. Current state:

- **Offer canon = wave-1 (A):** $500 setup + $99/mo locked for life, 2 founding slots,
  then $199/mo public. 48h free diagnosis BEFORE payment (the Delay killer). Guarantee:
  first plated deliverable within 7 days or the $500 back. 15 min/week. Cancel anytime.
  master tip 97ef0de90 and the working tree both tell this story. Do not reintroduce
  per-employee pricing or the $500/mo seat.
- **The $500/mo seat variant is ARCHIVED, not dead:** complete site on branch
  `archive/b-offer-500mo-seat`. It is tier T3 of the evidence-gated ladder (unlock:
  3 public case studies + 90 days of receipts). Ladder + gates: Aether/BETA_KIT.md.
- **TICKET_QUEUE.md (repo root):** file these into the runtime when it is up, 0a/0b
  (founding diagnoses for Anton and Michael, 48h clock) FIRST.
- **Founder actions pending (never do these for him):** send the founding offer
  (drafted, in the Aether session log and implied by the landing copy); deploy
  (`vercel --prod --yes` from apps/landing; NO git auto-deploy exists); reconnect
  Stripe, then mint the $500+$99/mo founding link and deactivate the old $49/mo
  founding, $29 sellsniper, and $500/mo seat (8x2eVd...) links; Vercel project rename
  vitals.run -> summon-company.
- **Machine-readable schema caveat:** index.html JSON-LD from SUM-153 says "$99 per AI
  employee per month"; reconcile to the wave-1 company-level offer on the next pass.

## Product and doctrine

summon.company is a provider-neutral control plane for AI-agent companies. It diagnoses a
company constraint, assigns one accountable employee, executes through a Claude, Codex,
Cognition, Cursor, OpenClaw, or future adapter, verifies business impact, and repeats.
Adam is the board. Summon is Company Zero and dogfoods the loop on itself.

The long-term scoreboard is becoming the world's most valuable company by maximizing
verified usefulness: value created per company multiplied by companies and people
measurably improved. Market cap is a lagging result, not a daily metric.

There are exactly eight departments. Product is not a ninth: the Cofounder owns product
strategy, Engineering owns product execution, and every other department supplies
requirements and evidence through its existing ownership.

Read `SUMMON_COMPANY_STANDARD.md`, `SUMMON_FORMATION_ROADMAP.md`, and `DESIGN.md` before
product work.

## Repository and fork

- GitHub: `adamtpang/summon.company`
- `origin`: the Summon fork
- `upstream`: `paperclipai/paperclip`
- Engine: repository root
- Product UI: additive routes and components under `ui/`
- Landing: `apps/landing/`
- Portable installer: `installer` branch

Preserve `@paperclipai/*`, `PAPERCLIP_*`, database, API, and protocol names. Prefer
additive Summon surfaces. Do not force-push or split the landing and engine again.

## Company Zero live state

Main control plane: `http://127.0.0.1:3100`, packaged version `2026.707.0`.
Isolated brand preview: `http://127.0.0.1:3102`, fork version `0.3.1`.

- S0 `SUM-14` Runtime portability: `blocked`, owner Engineering.
- S1 `SUM-22` Operating context: `done`, owner Operations.
- S2 `SUM-4` Design dogfood: `done`, owner Design.
- S3 `SUM-13` Critical path: `done`, owner Engineering.
- S4 `SUM-11` Diagnosis loop: `done`, owner Operations.

Engineering and Design are temporarily paused because queued comment wakeups can
reopen terminal issues after a packaged-runtime restart. Resume either only for a fresh
assignment or deliberate canary. Current status command reports zero active runs.
SUM-53 fixed the wake bug in source (delivery-time terminal check plus
`issue.wake_dropped_terminal` audit events); semantics, regression tests, and the
unpause criteria live in the historical `doc/VIT-53-WAKE-SEMANTICS.md`. The live packaged
runtime still predates the fix, so rollout rides the SUM-14 cutover.

Company Zero IDs and repeatable configuration live in
`scripts/vitals-company-zero-bootstrap.mjs`. `SUM` is the issue prefix.

## Delivered work

- `SUMMON_COMPANY_STANDARD.md`: opinionated core-eight company operating standard.
- `/:companyPrefix/formation`: eight-department formation and current constraint.
- `/roadmap` and `/:companyPrefix/roadmap`: eight real stages and one critical path.
- Provider-neutral skill/instruction preservation and Codex model-profile coverage.
- Windows auth-link and Paperclip-owned skill-link materialization fallbacks.
- Company Zero bootstrap, status, and board-comment scripts.
- Brand worktree at
  `C:\Users\adamp\OneDrive\Aether\.worktrees\vitals-run-brand-system-20260714`
  on `codex/vitals-brand-system`, with source-of-truth brand docs and desktop/mobile
  evidence. It is not merged or deployed; those remain board decisions.

## S0 exact blocker

Source fixes and focused tests pass, but this checkout's source migration journal is not
compatible with the database created by the live packaged runner. Starting source against
that database reports a large pending migration set and collides with existing schema.
Do not point source at the live database. Build a version-compatible package or align the
migration lineage, prove it on an isolated clone, take a backup, run a canary, then cut
over with a rollback command.

No agent may restart or migrate the main control plane while company runs are active.
Treat comments on terminal issues as executable wake events in the current runtime.

## Verification completed

- Provider-neutral materialized-skill fallback: 2 of 2 tests pass.
- Codex skill-injection suite: 4 of 4 tests pass.
- Focused adapter/runtime coverage: 115 tests pass, 7 are skipped.
- Adapter utils and Codex adapter typechecks pass.
- Formation/Roadmap/sidebar/routing UI coverage: 43 tests pass.
- Canonical UI typecheck and production build pass.
- Brand worktree BrandSystem coverage: 4 of 4 tests, UI typecheck, and build pass.
- `git diff --check` and Company Zero script syntax checks pass.
- Repository-wide token gate still has 112 pre-existing violations; none are in the
  changed brand-worktree files.

## Operating commands

```bash
node scripts/vitals-company-zero-bootstrap.mjs
node scripts/vitals-company-zero-status.mjs
node scripts/vitals-company-zero-bootstrap.mjs --wake=SUM-14
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/ui build
```

Use Summon to choose, assign, govern, and verify company work. Use Claude, Codex,
Cognition, or another adapter to edit code. The control plane owns the outcome and
evidence; the IDE is replaceable execution machinery.

## gstack

Installed 2026-07-26 from `paperclipai/companies` (the upstream template repo
behind companies.sh, where gstack is the top install at 682). All 27 skills live
in `.claude/skills/`, project-scoped to this repo.

The division of labor: **Summon owns the company layer** (which work happens, by
whom, approved by the board). **gstack owns the craft layer** (how one change is
reviewed, verified, and shipped). gstack skills never make company decisions, and
Summon never reimplements a gstack checklist.

Name-collision ruling for agents working in this repo:

| Name | Winner | Why |
|---|---|---|
| `/cso` | Adam's user-scope skill | Tuned to him. gstack's is installed as `/gstack-cso` (its 14-phase infrastructure audit) |
| `/review`, `/ship`, `/qa`, `/qa-only`, `/investigate`, `/retro` | gstack | Tuned to a repo, and no user-scope skill of these names exists |
| `/design-review`, `/canary`, `/benchmark`, `/guard` | gstack | No competing skill; these are the real names (there is no `/health`) |
| `/elon-algo`, `/offer-check`, `/invoice`, `/summon` | Summon | Company layer, not craft |

Department bindings (in each agent's instruction bundle, additive and never
blocking): Engineering calls `/review` before in_review and `/ship` for
release-shaped work, plus `/investigate` for bugs and `/codex` for a cross-model
second opinion. Design calls `/design-review` on changed surfaces and `/qa` when
the change is user-visible. Operations calls `/canary` after a deploy,
`/benchmark` for the health picture, and `/guard` before destructive work.
Legal, Finance, Sales, Marketing, and Support get no binding; their work is not
code.

### The install has two parts (both required)

1. **Project scope**, `.claude/skills/<name>/` in this repo: the 27 skill
   bodies, so Claude Code discovers them by name for anyone working here.
   Source is `garrytan/gstack`, NOT `paperclipai/companies` (that repo ships
   declaration-only manifests with `usage: referenced` and no procedure body,
   which is discoverable but does nothing when called).
2. **User scope**, `~/.claude/skills/gstack/`: the full gstack repo, because
   every skill body hardcodes `~/.claude/skills/gstack/bin/...` for its 75
   helpers. Without it, telemetry, learnings, decisions, review logs, and
   specialist stats all silently no-op.

State lives in `~/.gstack/`: `projects/<slug>/learnings.jsonl`,
`decisions.jsonl`, `<branch>-reviews.jsonl`, `timeline.jsonl`. Verified
working on this machine 2026-07-26.

Local patch worth knowing about: `lib/bin-context.ts` `resolveSlug()` spawned
the `gstack-slug` shebang script directly, which Windows cannot exec, so every
decision landed in `projects/unknown/`. Patched with a win32 branch that routes
through bash. A gstack upgrade overwrites it; re-apply or upstream it.

Missing dependency: `jq` is absent on this machine. Ten helpers need it (both
dashboards, `artifacts-init`, and the six gbrain helpers). The core review and
ship loop does not.

Refresh note: this install is a file copy, not a link. Re-copy both parts from
`garrytan/gstack` after any upstream change or the skills go stale.
`/gstack-upgrade` handles its own self-update path.

## 2026-08-29 commercial-distance handoff

The Aether Portfolio now opens with a private **Closest to cash** league below
the portfolio north star. It ranks projects by hard commercial evidence instead
of inventing another 0 to 100 score:

1. measured revenue
2. active live checkout
3. connected live payment rail
4. exact Summon company link
5. unformed project
6. evidence blocker

The server projection reads existing portfolio economics and Company Payments
evidence, exposes only safe aggregates, and supplies one exact next action for
each row. The UI shows stage counts plus a dense rank, company, position, money
evidence, and next-action table. It does not claim that site quality is revenue.

Changed surfaces:

- `packages/shared/src/types/aether-portfolio.ts`
- `server/src/services/aether-portfolio.ts`
- `server/src/services/aether-portfolio.test.ts`
- `ui/src/pages/AetherPortfolio.tsx`
- `ui/src/pages/AetherPortfolio.test.tsx`

Verification: focused server and UI tests pass, 20 of 20. Shared and UI
typechecks pass. The UI production build passes. The server typecheck still has
two unrelated pre-existing errors in `server/src/services/recovery/service.ts`
for missing `createdAt` and `startedAt` properties. Desktop visual evidence is
at `screenshots/summon-closest-to-cash-desktop-20260829.png`. The preview used a
fresh `PAPERCLIP_HOME` on port 3104 and did not touch the live control plane.
<!-- END:imported-codex-context -->
<!-- BEGIN:codex-chat-continuation -->
Codex chat continuation: read `CLAUDE_CONTINUE_FROM_CODEX.md` to resume from the latest local Codex sessions for this project.
<!-- END:codex-chat-continuation -->
<!-- BEGIN:summon-standard -->
Summon standard: this company must pass the six readiness gates in `summon.company/SUMMON_COMPANY_STANDARD.md` (Outcome, Evidence, Workspace, Organization, Skills, Runtime). Read `NORTH_STAR.md`, `EVIDENCE.md`, `company/ORGANIZATION.md`.
<!-- END:summon-standard -->

<!-- BEGIN:grok-chat-continuation -->
Grok chat continuation: read `GROK_CONTINUE_FROM_CLAUDE.md` and/or `GROK_CONTINUE_FROM_CODEX.md` when resuming in Grok. Refresh with `node .grok/sync-to-grok.js` from Aether root.
<!-- END:grok-chat-continuation -->
# AGENTS.md

<!-- BEGIN:claude-chat-continuation -->
Claude chat continuation: read `CODEX_CONTINUE_FROM_CLAUDE.md` to resume from the latest local Claude Code sessions for this project.
<!-- END:claude-chat-continuation -->

<!-- BEGIN:imported-claude-context -->
# summon.company cross-agent handoff

Last updated: 2026-08-01 by Claude (board handoff below). Prior: 2026-07-14 by Codex.

## BOARD HANDOFF 2026-08-01: summon work lives HERE now

Adam's ruling: Aether root sessions handle portfolio only; ALL summon execution
happens in summon.company sessions and the kitchen. Current state:

- **Offer canon = wave-1 (A):** $500 setup + $99/mo locked for life, 2 founding slots,
  then $199/mo public. 48h free diagnosis BEFORE payment (the Delay killer). Guarantee:
  first plated deliverable within 7 days or the $500 back. 15 min/week. Cancel anytime.
  master tip 97ef0de90 and the working tree both tell this story. Do not reintroduce
  per-employee pricing or the $500/mo seat.
- **The $500/mo seat variant is ARCHIVED, not dead:** complete site on branch
  `archive/b-offer-500mo-seat`. It is tier T3 of the evidence-gated ladder (unlock:
  3 public case studies + 90 days of receipts). Ladder + gates: Aether/BETA_KIT.md.
- **TICKET_QUEUE.md (repo root):** file these into the runtime when it is up, 0a/0b
  (founding diagnoses for Anton and Michael, 48h clock) FIRST.
- **Founder actions pending (never do these for him):** send the founding offer
  (drafted, in the Aether session log and implied by the landing copy); deploy
  (`vercel --prod --yes` from apps/landing; NO git auto-deploy exists); reconnect
  Stripe, then mint the $500+$99/mo founding link and deactivate the old $49/mo
  founding, $29 sellsniper, and $500/mo seat (8x2eVd...) links; Vercel project rename
  vitals.run -> summon-company.
- **Machine-readable schema caveat:** index.html JSON-LD from SUM-153 says "$99 per AI
  employee per month"; reconcile to the wave-1 company-level offer on the next pass.

## Product and doctrine

summon.company is a provider-neutral control plane for AI-agent companies. It diagnoses a
company constraint, assigns one accountable employee, executes through a Claude, Codex,
Cognition, Cursor, OpenClaw, or future adapter, verifies business impact, and repeats.
Adam is the board. Summon is Company Zero and dogfoods the loop on itself.

The long-term scoreboard is becoming the world's most valuable company by maximizing
verified usefulness: value created per company multiplied by companies and people
measurably improved. Market cap is a lagging result, not a daily metric.

There are exactly eight departments. Product is not a ninth: the Cofounder owns product
strategy, Engineering owns product execution, and every other department supplies
requirements and evidence through its existing ownership.

Read `SUMMON_COMPANY_STANDARD.md`, `SUMMON_FORMATION_ROADMAP.md`, and `DESIGN.md` before
product work.

## Repository and fork

- GitHub: `adamtpang/summon.company`
- `origin`: the Summon fork
- `upstream`: `paperclipai/paperclip`
- Engine: repository root
- Product UI: additive routes and components under `ui/`
- Landing: `apps/landing/`
- Portable installer: `installer` branch

Preserve `@paperclipai/*`, `PAPERCLIP_*`, database, API, and protocol names. Prefer
additive Summon surfaces. Do not force-push or split the landing and engine again.

## Company Zero live state

Main control plane: `http://127.0.0.1:3100`, packaged version `2026.707.0`.
Isolated brand preview: `http://127.0.0.1:3102`, fork version `0.3.1`.

- S0 `SUM-14` Runtime portability: `blocked`, owner Engineering.
- S1 `SUM-22` Operating context: `done`, owner Operations.
- S2 `SUM-4` Design dogfood: `done`, owner Design.
- S3 `SUM-13` Critical path: `done`, owner Engineering.
- S4 `SUM-11` Diagnosis loop: `done`, owner Operations.

Engineering and Design are temporarily paused because queued comment wakeups can
reopen terminal issues after a packaged-runtime restart. Resume either only for a fresh
assignment or deliberate canary. Current status command reports zero active runs.
SUM-53 fixed the wake bug in source (delivery-time terminal check plus
`issue.wake_dropped_terminal` audit events); semantics, regression tests, and the
unpause criteria live in the historical `doc/VIT-53-WAKE-SEMANTICS.md`. The live packaged
runtime still predates the fix, so rollout rides the SUM-14 cutover.

Company Zero IDs and repeatable configuration live in
`scripts/vitals-company-zero-bootstrap.mjs`. `SUM` is the issue prefix.

## Delivered work

- `SUMMON_COMPANY_STANDARD.md`: opinionated core-eight company operating standard.
- `/:companyPrefix/formation`: eight-department formation and current constraint.
- `/roadmap` and `/:companyPrefix/roadmap`: eight real stages and one critical path.
- Provider-neutral skill/instruction preservation and Codex model-profile coverage.
- Windows auth-link and Paperclip-owned skill-link materialization fallbacks.
- Company Zero bootstrap, status, and board-comment scripts.
- Brand worktree at
  `C:\Users\adamp\OneDrive\Aether\.worktrees\vitals-run-brand-system-20260714`
  on `codex/vitals-brand-system`, with source-of-truth brand docs and desktop/mobile
  evidence. It is not merged or deployed; those remain board decisions.

## S0 exact blocker

Source fixes and focused tests pass, but this checkout's source migration journal is not
compatible with the database created by the live packaged runner. Starting source against
that database reports a large pending migration set and collides with existing schema.
Do not point source at the live database. Build a version-compatible package or align the
migration lineage, prove it on an isolated clone, take a backup, run a canary, then cut
over with a rollback command.

No agent may restart or migrate the main control plane while company runs are active.
Treat comments on terminal issues as executable wake events in the current runtime.

## Verification completed

- Provider-neutral materialized-skill fallback: 2 of 2 tests pass.
- Codex skill-injection suite: 4 of 4 tests pass.
- Focused adapter/runtime coverage: 115 tests pass, 7 are skipped.
- Adapter utils and Codex adapter typechecks pass.
- Formation/Roadmap/sidebar/routing UI coverage: 43 tests pass.
- Canonical UI typecheck and production build pass.
- Brand worktree BrandSystem coverage: 4 of 4 tests, UI typecheck, and build pass.
- `git diff --check` and Company Zero script syntax checks pass.
- Repository-wide token gate still has 112 pre-existing violations; none are in the
  changed brand-worktree files.

## Operating commands

```bash
node scripts/vitals-company-zero-bootstrap.mjs
node scripts/vitals-company-zero-status.mjs
node scripts/vitals-company-zero-bootstrap.mjs --wake=SUM-14
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/ui build
```

Use Summon to choose, assign, govern, and verify company work. Use Claude, Codex,
Cognition, or another adapter to edit code. The control plane owns the outcome and
evidence; the IDE is replaceable execution machinery.

## gstack

Installed 2026-07-26 from `paperclipai/companies` (the upstream template repo
behind companies.sh, where gstack is the top install at 682). All 27 skills live
in `.claude/skills/`, project-scoped to this repo.

The division of labor: **Summon owns the company layer** (which work happens, by
whom, approved by the board). **gstack owns the craft layer** (how one change is
reviewed, verified, and shipped). gstack skills never make company decisions, and
Summon never reimplements a gstack checklist.

Name-collision ruling for agents working in this repo:

| Name | Winner | Why |
|---|---|---|
| `/cso` | Adam's user-scope skill | Tuned to him. gstack's is installed as `/gstack-cso` (its 14-phase infrastructure audit) |
| `/review`, `/ship`, `/qa`, `/qa-only`, `/investigate`, `/retro` | gstack | Tuned to a repo, and no user-scope skill of these names exists |
| `/design-review`, `/canary`, `/benchmark`, `/guard` | gstack | No competing skill; these are the real names (there is no `/health`) |
| `/elon-algo`, `/offer-check`, `/invoice`, `/summon` | Summon | Company layer, not craft |

Department bindings (in each agent's instruction bundle, additive and never
blocking): Engineering calls `/review` before in_review and `/ship` for
release-shaped work, plus `/investigate` for bugs and `/codex` for a cross-model
second opinion. Design calls `/design-review` on changed surfaces and `/qa` when
the change is user-visible. Operations calls `/canary` after a deploy,
`/benchmark` for the health picture, and `/guard` before destructive work.
Legal, Finance, Sales, Marketing, and Support get no binding; their work is not
code.

### The install has two parts (both required)

1. **Project scope**, `.claude/skills/<name>/` in this repo: the 27 skill
   bodies, so Claude Code discovers them by name for anyone working here.
   Source is `garrytan/gstack`, NOT `paperclipai/companies` (that repo ships
   declaration-only manifests with `usage: referenced` and no procedure body,
   which is discoverable but does nothing when called).
2. **User scope**, `~/.claude/skills/gstack/`: the full gstack repo, because
   every skill body hardcodes `~/.claude/skills/gstack/bin/...` for its 75
   helpers. Without it, telemetry, learnings, decisions, review logs, and
   specialist stats all silently no-op.

State lives in `~/.gstack/`: `projects/<slug>/learnings.jsonl`,
`decisions.jsonl`, `<branch>-reviews.jsonl`, `timeline.jsonl`. Verified
working on this machine 2026-07-26.

Local patch worth knowing about: `lib/bin-context.ts` `resolveSlug()` spawned
the `gstack-slug` shebang script directly, which Windows cannot exec, so every
decision landed in `projects/unknown/`. Patched with a win32 branch that routes
through bash. A gstack upgrade overwrites it; re-apply or upstream it.

Missing dependency: `jq` is absent on this machine. Ten helpers need it (both
dashboards, `artifacts-init`, and the six gbrain helpers). The core review and
ship loop does not.

Refresh note: this install is a file copy, not a link. Re-copy both parts from
`garrytan/gstack` after any upstream change or the skills go stale.
`/gstack-upgrade` handles its own self-update path.
<!-- END:imported-claude-context -->

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `doc/`: operational and product docs

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep repo plan docs dated and centralized.
When you are creating a plan file in the repository itself, new plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames. This does not replace Paperclip issue planning: if a Paperclip issue asks for a plan, update the issue `plan` document per the `paperclip` skill instead of creating a repo markdown file.

6. Attach inspectable generated artifacts.
When your task produces a user-inspectable deliverable file, follow the Paperclip skill's "Generated Artifacts and Work Products" workflow before final disposition. In this repo, prefer the self-contained skill helper at `skills/paperclip/scripts/paperclip-upload-artifact.sh` so the file is available through the Paperclip API, create/update an artifact work product when the file is the deliverable, link the uploaded artifact in the final issue comment, and then set status. Do not rely on local filesystem paths as the only access path. If an important file intentionally remains workspace-only, create/update a work product with `metadata.resourceRef.kind: "workspace_file"` and a workspace-relative path, then name that work product and path in the final comment. Treat browse/search as a fallback for recovering workspace files, not the preferred deliverable path. See `doc/AGENT-ARTIFACTS.md` for details and `.mp4`/`.webm` examples.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Default local/agent test path:

```sh
pnpm test
```

This is the cheap default and only runs the Vitest suite. Browser suites stay opt-in:

```sh
pnpm test:e2e
pnpm test:release-smoke
```

Run the browser suites only when your change touches them or when you are explicitly verifying CI/release flows.

For normal issue work, run the smallest relevant verification first. Do not default to repo-wide typecheck/build/test on every heartbeat when a narrower check is enough to prove the change.

Run this full check before claiming repo work done in a PR-ready hand-off, or when the change scope is broad enough that targeted checks are not sufficient:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Pull Request Requirements

When creating a pull request (via `gh pr create` or any other method), you **must** read and fill in every section of [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Do not craft ad-hoc PR bodies - use the template as the structure for your PR description. Required sections:

- **Thinking Path** - trace reasoning from project context to this change (see `CONTRIBUTING.md` for examples)
- **What Changed** - bullet list of concrete changes
- **Verification** - how a reviewer can confirm it works
- **Risks** - what could go wrong
- **Model Used** - the AI model that produced or assisted with the change (provider, exact model ID, context window, capabilities). Write "None - human-authored" if no AI was used.
- **Checklist** - all items checked

## 11. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. PR description follows the [PR template](.github/PULL_REQUEST_TEMPLATE.md) with all sections filled in (including Model Used)

## 12. summon.company fork

Read `SUMMON.md`, `CLAUDE.md`, and `SUMMON_FORMATION_ROADMAP.md` before product
work. The public product repository is `adamtpang/summon.company`; `upstream` remains
`paperclipai/paperclip`. Customer-facing behavior belongs in additive Summon
routes and components. Do not rename or fork shared Paperclip protocol surfaces.

## 13. Fork-Specific: HenkDz/paperclip

This is a fork of `paperclipai/paperclip` with QoL patches and a **built-in** Hermes adapter story on branch `feat/externalize-hermes-adapter` ([tree](https://github.com/HenkDz/paperclip/tree/feat/externalize-hermes-adapter)).

### Branch Strategy

- `feat/externalize-hermes-adapter` now ships `hermes_local` and `hermes_gateway` as built-in core adapters.
- Older fork branches may still document plugin-only Hermes; treat this file as authoritative for the current branch.

### Hermes (built-in)

- `hermes_local` is available without Adapter manager installation and runs the local Hermes CLI.
- `hermes_gateway` is available without Adapter manager installation and calls an already-running Hermes API server.
- Operators may still install external Hermes packages through Adapter manager to override/shadow the built-ins.
- Optional: `file:` entry in `~/.paperclip/adapter-plugins.json` remains useful for local development of override packages.

### Local Dev

- Fork runs on port 3101+ (auto-detects if 3100 is taken by upstream instance)
- `npx vite build` hangs on NTFS - use `node node_modules/vite/bin/vite.js build` instead
- Server startup from NTFS takes 30-60s - don't assume failure immediately
- Kill ALL paperclip processes before starting: `pkill -f "paperclip"; pkill -f "tsx.*index.ts"`
- Vite cache survives `rm -rf dist` - delete both: `rm -rf ui/dist ui/node_modules/.vite`

### Fork QoL Patches (not in upstream)

These are local modifications in the fork's UI. If re-copying source, these must be re-applied:

1. **stderr_group** - amber accordion for MCP init noise in `RunTranscriptView.tsx`
2. **tool_group** - accordion for consecutive non-terminal tools (write, read, search, browser)
3. **Dashboard excerpt** - `LatestRunCard` strips markdown, shows first 3 lines/280 chars

### Plugin System

PR #2218 (`feat/external-adapter-phase1`) adds external adapter support. See root `AGENTS.md` for full details.

- Adapters can be loaded as external plugins via `~/.paperclip/adapter-plugins.json`
- The plugin-loader should have ZERO hardcoded adapter imports - pure dynamic loading
- `createServerAdapter()` must include ALL optional fields (especially `detectModel`)
- Built-in UI adapters can shadow external plugin parsers; external override pause/resume should restore the built-in parser.
- Reference external adapters: Droid (npm); Hermes can also be tested as an override package.

## Design system

`DESIGN.md` at the repo root is the source of truth for UI design decisions. The token-only rule applies to all `ui/` changes: every color, spacing, radius, type, shadow, and motion value in `ui/src/components/**` and `ui/src/pages/**` comes from the token layer in `ui/src/index.css` - no hex, raw px, arbitrary Tailwind bracket values, or raw `font-size`/`fontSize` declarations in components, outside the documented allowlist in `ui/src/index.css`. Run `pnpm check:token-gates` (`scripts/check-token-gates.mjs`) before committing UI changes - it fails on any violation not covered by that allowlist.
