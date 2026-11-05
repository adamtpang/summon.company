# Fleet to Focus integration

Date: 2026-09-05

Adam accepted the Focus shell direction and selected Fleet command as the next
surface. No further authenticated Rocket inspection was needed to settle a design
uncertainty. This integration preserves the approved bounded workflow.

## Integrated source

The runnable result is in `tmp/fleet-integration/`, a separate detached worktree at
canonical Fleet commit `9f6a6560d569d00bd2301e21ecbedf631cf252d9` with the newer local
Fleet source dependencies copied in. The canonical checkout was read only. The
original Focus pilot in this outer worktree remains preserved.

`tmp/fleet-source-provenance.json` records hashes of the 390 source dependencies
copied from canonical. `tmp/fleet-focus-handoff/focus-integration.patch` contains
only the 16 integration files relative to their captured source baselines, not
the larger pre-existing Fleet changes. `changed-files.json` beside it records
normalized-content hashes. The patch passes reverse application checking against
the integrated source. Apply it only to the same Fleet baseline or review its
hunks against a later version.

The integration links a Fleet constraint to its persisted task using company,
origin, and binding department identity. It adds the company-scoped Focus route,
navigation, and an explicit task URL. Missing and foreign links show errors;
they never silently select a different task. Closure refreshes the task, requires
evidence, respects execution and dependency blockers, and saves through the
existing issue API. A receipt links back to the full task. Server authorization
and concurrency semantics remain authoritative.

The Windows test launcher also invokes the installed Vitest entry point through
Node directly, fixing the `spawnSync pnpm ENOENT` failure without changing test
selection or arguments.

## Isolated workflow evidence

The real source runtime is at `http://127.0.0.1:3119`, backed by a new, empty
database on port 54419. Runtime home, database, and synthetic workspace are inside
`tmp/fleet-integration/tmp/focus-runtime/`. Initialization used `--no-seed` and a
nonexistent source config. No main control-plane database or company was copied,
restarted, migrated, or edited. No agents were created; heartbeat scheduling is
disabled. The sample task is unassigned.

Helium verified the following against the real UI and API:

1. Fleet's sample.example link opened the exact task URL for SAM-1, ID
   `553deebc-3618-4b24-bf00-1fc15dc5aeab`.
2. Closure stayed disabled until evidence and confirmation were provided.
3. Saving returned a closure receipt and removed SAM-1 from the review queue.
4. Independent API reads confirmed `done` and exactly one evidence comment.
5. The receipt link opened `/SAM/issues/SAM-1`, displaying the saved evidence.
6. Returning to Fleet removed the completed constraint's task identity from its
   link. Reopening the old exact URL kept SAM-1 visible with closure disabled.
7. At 390 CSS pixels wide, Focus had no horizontal overflow.

Evidence: `focus-before.png` and `focus-mobile-closed.png` in the isolated runtime
directory. `seed.mts` and `fixture.json` there make the synthetic fixture inspectable.
The receipt explicitly states that this proves software behavior, not a payment
or income outcome. The old in-memory preview on port 3118 is not this verification.

## Verification and limits

- Focused tests: 23 passed across Focus logic, exact constraint matching, Fleet
  links, and Focus UI failure/deep-link behavior. Log: `tmp/fleet-focused-final.log`.
- UI typecheck passed. UI production build passed within the broad build.
- Repository typecheck and build fail in the existing recovery service at lines
  3317 and 3318: `LatestIssueRun` lacks `createdAt` and `startedAt`. Its query also
  omits those fields, so a type-only workaround would hide a behavior defect.
  Logs: `tmp/fleet-typecheck.log`, `tmp/fleet-build-final.log`.
- Repository tests were started with the repaired launcher, then manually stopped
  after roughly 24 minutes once multiple failures established a red gate. This is
  an incomplete run, not a complete suite result. Failures include workspace
  recovery/finalization, mobile-build webhook artifacts, teams catalog hashes,
  and runtime configuration expectations. They are outside the Focus changes;
  their root causes were not all diagnosed. The runner was still in its general
  server group. General workspace groups and 110 serialized suites were not
  reached. Logs: `tmp/fleet-tests.log`, `tmp/fleet-test-plan.json`.
- Token gate reports 90 violations in pre-existing source; none are in the
  integration's changed components. Log: `tmp/fleet-token-gates.log`.
- `git diff --check` and patch reverse-application checking pass.

Canonical's lockfile does not match its patched-dependency configuration. Only
the isolated checkout regenerated its lockfile for installation. Two ignored
generated UI inputs, Watchtower and audit table, contain empty synthetic data to
allow a build without importing private snapshots. Those inputs, lockfile changes,
and build-generated catalogs are excluded from the integration patch.

This is a verified local workflow, not a clean repository-wide or deployment
handoff. Artifacts intentionally remain workspace-only; no publication, live
work-product upload, commit, push, or production write was performed.

## Next surface

Adam selected **Fleet command**. Carry the approved Focus direction into the Fleet
entry page: make the current constraint and accountable next action obvious, then
retain the exact handoff into Focus. Broader shell replacement remains outside
this integration. Resolve the repository checks before treating it as PR-ready.

## Bounded overnight verification, 2026-09-06

Reviewed the reported failing suites against this integration's file manifest.
No reported failure named Focus, Fleet cockpit, company routing, or the portfolio
service. Re-ran those areas together rather than changing unrelated code:

```powershell
node node_modules/vitest/vitest.mjs run ui/src/lib/summon-focus.test.ts ui/src/pages/SummonFocus.test.tsx ui/src/pages/AetherPortfolioCockpit.test.tsx ui/src/lib/company-routes.test.ts server/src/services/aether-constraint-focus.test.ts server/src/services/aether-portfolio.test.ts
```

Result: **6 files, 53 tests passed**, 36.98 seconds, against
`tmp/fleet-integration/`. Log: `tmp/fleet-overnight-regression.log`.
All 16 integration files still match their packaged normalized-content hashes.
Patch reverse-application checking passed. No source or test files were changed,
and no failing cluster attributable to Fleet/Focus was reproduced.

The previously reported recovery-service type errors remain outside the patch;
that file has no diff from the integration worktree's base. Other broad-suite
failures remain recorded above, with their causes not all diagnosed. This focused
pass does not establish a green repository-wide gate. No broad rerun, Fleet
redesign, runtime mutation, or additional backlog work was started.

Morning receipt: only this report was updated; the regression log is local and
ignored. No owner input was required for this verification. Any repair of the
unrelated recovery/platform/catalog failures remains a separately bounded scope.
