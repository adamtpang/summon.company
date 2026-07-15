# vitals.run cross-agent handoff

Last updated: 2026-07-14 by Codex.

## Product and doctrine

vitals.run is a provider-neutral control plane for AI-agent companies. It diagnoses a
company constraint, assigns one accountable employee, executes through a Claude, Codex,
Cognition, Cursor, OpenClaw, or future adapter, verifies business impact, and repeats.
The human is the board. Vitals is Company Zero and dogfoods the loop on itself.

The long-term scoreboard is becoming the world's most valuable company by maximizing
verified usefulness: value created per company multiplied by companies and people
measurably improved. Market cap is a lagging result, not a daily metric.

There are exactly eight departments. Product is not a ninth: the CEO owns product
strategy, Engineering owns product execution, and every other department supplies
requirements and evidence through its existing ownership.

Read `VITALS_COMPANY_STANDARD.md`, `VITALS_FORMATION_ROADMAP.md`, and `DESIGN.md` before
product work.

## Repository and fork

- GitHub: `adamtpang/vitals.run`
- `origin`: the Vitals fork
- `upstream`: `paperclipai/paperclip`
- Engine: repository root
- Product UI: additive routes and components under `ui/`
- Landing: `apps/landing/`
- Portable installer: `installer` branch

Preserve `@paperclipai/*`, `PAPERCLIP_*`, database, API, and protocol names. Prefer
additive Vitals surfaces. Do not force-push or split the landing and engine again.

## Company Zero live state

Main control plane: `http://127.0.0.1:3100`, packaged version `2026.707.0`.
Isolated brand preview: `http://127.0.0.1:3102`, fork version `0.3.1`.

- S0 `VIT-14` Runtime portability: `blocked`, owner Vitals CTO.
- S1 `VIT-22` Operating context: `done`, owner Vitals COO.
- S2 `VIT-4` Design dogfood: `done`, owner Vitals Design Director.
- S3 `VIT-13` Critical path: `done`, owner Vitals Engineer.
- S4 `VIT-11` Diagnosis loop: `done`, owner Vitals Company Diagnostician.

The CTO and Design Director are temporarily paused because queued comment wakeups can
reopen terminal issues after a packaged-runtime restart. Resume either only for a fresh
assignment or deliberate canary. Current status command reports zero active runs.

Company Zero IDs and repeatable configuration live in
`scripts/vitals-company-zero-bootstrap.mjs`. `VIT` is the issue prefix, not an acronym.

## Delivered work

- `VITALS_COMPANY_STANDARD.md`: opinionated core-eight company operating standard.
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
node scripts/vitals-company-zero-bootstrap.mjs --wake=VIT-14
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/ui build
```

Use Vitals to choose, assign, govern, and verify company work. Use Claude, Codex,
Cognition, or another adapter to edit code. The control plane owns the outcome and
evidence; the IDE is replaceable execution machinery.
