# Summon Focus local pilot

Date: 2026-09-05

## Delivered behavior

`/:companyPrefix/focus` opens a Summon shell with a compact dark task rail and one
task canvas. The existing sidebar has a Focus entry. Select a project, inspect its
blocked or review tasks in priority and age order, see the accountable owner and
task context, then record evidence and explicitly confirm completion. Closure
refreshes the task first, rejects foreign-company, terminal, execution-owned, or
dependency-blocked work, and uses the existing update contract. A successful
terminal response removes the row and shows a receipt. Errors retain the evidence.
The complete task and its receipts remain linked through this branch's `/issues`
routes. Internal Paperclip package, protocol, and API names are unchanged.

This shortens the route from seeing a blocker to reviewing its closure. It does
not classify a project as commercial, prove income, or close any real blocker as
part of implementation. The founder selects the income project explicitly.

## Recovery and provenance

- Isolated worktree base: `635cef576a5f9f9abadef17b134f803250e9290f`.
- Canonical checkout inspected read-only at `9f6a6560d569d00bd2301e21ecbedf631cf252d9`.
- Previous task: `01a05730-9097-7060-b854-09584ce788f6`. Its recorded commands used the
  canonical checkout and the isolated Fleet preview home on port 3114.
- Reviewed the canonical untracked `ui/src/pages/AetherPortfolioCockpit.tsx`, its
  Board focus behavior, the previous task, local status, handoff, design plan,
  and Shapeable owner preferences. Fleet's constraint action opens a general task
  list. That navigation gap motivated this focused workflow.
- The old Fleet preview had no listener on port 3114 when inspected. It was not
  restarted. No main database, runtime, agent, or other checkout was modified.
- No uncommitted source was copied. The broader Fleet backend and its untracked
  dependencies are not present on this base. This pilot uses the base's supported
  company-scoped APIs instead of importing the entire unfinished backend.
- Routing differs: canonical Fleet uses `/tasks`; this base uses `/issues`.
  Focus links use the latter and its company-prefix helper has regression coverage.
  Do not wholesale replace canonical App, Layout, Sidebar, or design files with
  this worktree's versions. Integrate the small additions into the newer source.

## Verification

- 23 focused tests pass across closure, queue isolation/order, and company routing.
- UI typecheck and production build pass. Build warnings concern existing CSS
  highlight syntax, dependency annotations, and large chunks.
- Helium fixture checks: project filtering, disabled submit before verification,
  evidence entry, confirmation, successful closure receipt, and removal from queue.
- Inspected 1440 x 900 desktop and 390 x 844 mobile screenshots. Mobile content
  width is 390, with a bounded scrollable queue and no horizontal overflow.
- `git diff --check` passes.
- Token gate remains red on 57 existing violations, none in changed files.
- Full repository typecheck, test suite, and engine build were not run: this is a
  bounded local UI pilot, not a PR-ready or runtime-cutover handoff.

## Local review and limits

The fixture preview at `http://127.0.0.1:3118/` renders the actual Focus component
with synthetic data and in-memory API substitutes. Refresh resets its task state.
It cannot change any live tasks, payments, or company data. Full-task links require
the real application and are not implemented by the fixture.

Workspace-only preview files, screenshots, and logs are in `tmp/focus-preview/`.
Restart locally from this worktree with:

```powershell
node ui/node_modules/vite/bin/vite.js --config tmp/focus-preview/vite.config.mjs
```

These inspection artifacts stay local because the task forbids publication and
runtime writes. No work-product upload or issue comment was performed.

Real closure still follows the existing server's completion and dependent-work
semantics. This pilot is not a concurrency lock or a new authorization layer;
the server remains authoritative. Live closure and full-runtime integration have
not been exercised. No real income outcome is claimed.

## One owner action and next step

Adam accepted the fixture shell direction. The integration and real isolated
workflow results now live in `2026-09-05-fleet-focus-integration.md` beside this
document. Fleet command is the selected next shell surface.

The newer Fleet integration and its isolated-runtime verification are complete.
See the integration report for remaining repository-check failures and the next
selected surface. The protected main runtime and unrelated changes are preserved.
