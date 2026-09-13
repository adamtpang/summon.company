# Company factory commissioning

Date: 2026-09-07. Requested by Adam: reach usable company-factory operation quickly.
This is an execution sequence with evidence gates, not a dated launch promise.
No hard deadline is set. Prior status: isolated registry and Focus workflow proven;
continuous live operation is not yet proven. Do not express feature completion as
an autonomy percentage.

## Milestones

| Gate | Accountable role | Acceptance evidence | Current status |
| --- | --- | --- | --- |
| 1. Stable execution baseline | CTO / Codex | One identified source checkout; relevant checks green; compatible isolated database; startup and rollback/restart demonstrated; known failures classified | In progress: recovery repaired; 96 focused tests pass; typecheck/build pass across corrected runs; isolated restart proven; full suite remains open |
| 2. Exact fleet registry | COO | Approved inventory maps each company to repository/workspace, domain, provider project and ownership; ambiguity visible; repeat import creates no duplicates | Partial: 47/47 isolated repository links previously verified, current live inventory still needs reconciliation |
| 3. Pilot operating contract | Adam, with CTO preparation | One named company, owner and task; permitted workspace, credentials, model, resource cap, cadence, acceptance and stop conditions recorded | Pilot selection requested; recommend Summon / Company Zero |
| 4. Autonomous code loop | Pilot engineering owner | One real bounded task is diagnosed, assigned, executed, tested, reviewed and evidenced without repeated human prompting; no unrelated edits | Pending; Focus's synthetic closure is supporting evidence only |
| 5. Recovery and control | CTO | Restart with queued/running work does not duplicate execution; terminal tasks stay closed; failed provider becomes visible; pause/revoke/resource stops work; one owner and company isolation hold | Pending system acceptance; repair first known recovery defect now |
| 6. Useful business result | Pilot owner; Adam verifies | An independently inspectable before/after improvement in time, cost, reliability or revenue; execution result distinguished from customer delivery and paid outcome | Pending; no stranger revenue is required merely to prove internal factory usefulness |
| 7. Three-company repeated trial | COO | Repeated cycles across three approved companies; no cross-repo writes or secret leakage; fair scheduling; bounded total resources; failures and human interventions counted | Pending; proposed minimum 24 hours and three cycles each, including one restart/failure exercise |
| 8. Fleet rollout | COO; Adam controls activation | Only eligible companies activated in batches, with visible per-company state, evidence freshness, limits and rollback/pause path; unsupported companies remain held | Pending; no mass employee activation |
| 9. Repeatable company setup | COO | A further company goes from intake to exact repo mapping, approved minimal staffing, first bounded result and evidence using the same validated template | Pending; template only validated pieces |

## Fastest execution path

Finish gate 1 while gathering the pilot choice. Reuse the existing isolated Fleet
checkout at `tmp/fleet-integration/`; preserve the older outer Focus work and the
canonical checkout. Fix the recovery query/type mismatch, prove the behavior
against a test database, then rerun typecheck and build. Classify unrelated test
failures honestly. Reuse existing registry and work-product functionality.

Next, prepare a concrete pilot contract for Adam to review. Activation and use of
real providers remain dependent on that contract. A preview server or synthetic
mock adapter does not count as a live pilot. Prove one loop before distributing
work across many companies. Keep company factory commissioning in this existing
task; do not create duplicate goals, watchers, or tasks.

The useful-result metric depends on the chosen task. Examples: a formerly failing
workflow now passes, measured manual work is removed, a verified production defect
is resolved, or an attributable payment is received. Never use code volume, task
counts or an analytics enablement toggle as business impact.

## Boundaries and deferred work

This request authorizes local reversible implementation and verification toward
the factory. It does not resolve provider spend, production cutover, publishing,
or deployment decisions. Personal communication remains manual for Adam. Keep
existing application authorization and database/company boundaries intact.

Fleet redesign, additional provider integrations, a complete analytics platform,
and delivery-standard expansion can wait unless the pilot proves one is necessary.
The September 6 analytics proposal and private delivery intake remain preserved.
Do not gate this internal factory on choosing Summon's public pricing or selling
Summon to a stranger; those are separate commercial milestones.

## Execution receipt

Started with the known recovery defect: post-resume assignment recovery reads
run creation/start timestamps, but all three latest-run queries omit those fields.
Add database-backed coverage for creation after resume, start after resume, and
stale backlog. Record reproduction and final checks here as work completes.

### Repairs and regression evidence

- The new database-backed cases reproduced two failures before the repair. All
  three latest-run projections now select `createdAt` and `startedAt`, and the
  shared local result type requires both fields.
- Five selected database recovery tests pass: the three new cases, existing
  lost-run recovery, and paused-agent protection. An intervening run timed out
  in database setup under concurrent typechecking; the serial rerun passed with
  the timeout unchanged. These tests establish scheduling behavior, not a live
  provider's successful execution.
- Every workspace passed typechecking across the main run and the final CLI
  rerun. Four old CLI fixture errors were repaired using the schema's `manual`
  operating mode and zero budget defaults. No assertions were weakened.
- Expanded focused regression: 87 tests passed in ten files, including all prior
  Focus/portfolio coverage, CLI fixtures, and the resume gate.
- Four worktree isolation/preservation tests pass after correcting the launch
  environment's Git search path. The initial diagnostic reproduced `spawn git
  ENOENT`; an absolute Git executable worked. The isolated launch script selects
  one discovered executable and prepends its normalized directory. No host-wide
  environment setting or product-code machine path was changed.
- The production build exposed Unix-only asset-copy commands in the server.
  `server/scripts/copy-build-assets.mjs` uses Node filesystem operations instead.
  The CLI executable-bit step likewise uses Node instead of requiring `chmod`.

Repair files are confined to the isolated checkout. Backups live in
`tmp/factory-runtime-before/`; a supplemental patch is separate from the original
Focus patch. Logs use `tmp/factory-*.log`. The complete broad unit suite is still
not green or fully rerun, and historical unrelated failures remain open.

- All packages built across corrected runs, including the final targeted CLI
  build. A single uninterrupted root build has not yet passed: the root run had
  captured the old CLI command before its edit. All seven copied server assets
  match their source files. The supplemental eight-file patch passed reverse
  application checking against the current isolated source.
- The isolated runtime at `http://127.0.0.1:3119` reports healthy after restart,
  with migrations already applied and zero active runs. SAM-1 remains done and
  its exact synthetic closure evidence persists. Eight sample department agents
  remain pending approval; the built-in Reflection Coach remains paused.
  Heartbeats are disabled. This is persistence evidence, not live autonomy.
  Receipt: `tmp/factory-runtime-proof.json`.

## Proposed first pilot contract, not activated

Company: Summon / Company Zero, subject to Adam's pending selection. One
engineering owner uses the existing Codex adapter in an isolated checkout.
First assignment: reproduce one remaining repository test failure, make the
smallest justified repair, run the affected tests, and attach the diff and test
receipt to its task for review. No tests may be weakened just to pass.

Proposed bounds: one task, one concurrent run, a 15-minute execution limit, and
no automatic recurring dispatch until the first result is reviewed. No new paid
services or provider purchases. Existing provider-account usage and its actual
enforceable cap must be agreed before activation; zero new purchases does not
mean zero account usage. No deployment, main-database changes, remote pushes,
external messages or edits outside the assigned checkout. Stop on missing
credentials, ambiguous repository ownership, exhausted limits or unrelated
changes. Acceptance requires an inspectable diff, before/after test evidence,
preserved existing work and a terminal task disposition with a clear reason.

Next commissioning action: finish classifying the broad test failures, then
resolve the company/provider/resource fields and exercise this contract through
the control plane. The existing synthetic runtime is not Company Zero's live
database and must not be represented as such.
