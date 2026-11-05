# The register-truth agent (design, scaffold only)

Status 2026-07-30: **designed and stubbed, not wired.** The one-shot version has
already produced a real deliverable for Regain (`outbound/regain-register/`).
This document turns that one-shot into a recurring Summon capability.

## What it does

On every merged pull request in a paired repo, reconcile the company's written
findings registers against the code, and when code has closed something a
document still claims is open, propose the correction as a pull request the
customer's own team approves.

It never edits the customer's repo directly. Read-only by default, suggest-only
at first, human approves every write. That posture is not timidity, it is the
product: a register that silently self-edits is no more trustworthy than one
that silently goes stale.

## Proof it is worth building

Run against `regain-inc/miss` on 2026-07-30: their register, written 2026-07-14,
went 214 commits without an update. Seven of nine P0s were fully closed in code
and two partially, while the document a CEO would read still listed all nine as
open. Three of the closing commits even name the finding IDs in their titles
(`b4af6e64c`: "revive batch ETL scheduler + populate total_charges (P0-2, P0-4,
P0-7)"), so the link between commit and finding was already written down by a
human and simply never propagated back to the register.

## Where it plugs into Summon

Nothing here needs new infrastructure. Four existing layers carry it:

| Layer | Existing thing | Role for this agent |
|---|---|---|
| Ingress | `plugin_webhooks` table plus the plugin worker (`server/src/services/plugin-*.ts`) | Receives `pull_request.closed` with `merged: true` |
| Object model | `external_objects` and `server/src/services/external-objects.ts`, provider key `github` | The PR and the resulting doc PR both become first-class objects a task can point at |
| Work | `issues` plus the department routing already in place | A reconciliation that finds drift files a task for Engineering, with the receipt attached |
| Cadence | `routines` (`concurrencyPolicy: coalesce_if_active`, `catchUpPolicy: skip_missed`) | The nightly sweep that catches anything the webhook missed, with the right semantics already defaulted |

Secrets live in `company_secrets`, so the customer's GitHub token never touches
env or the repo.

## GitHub integration: App webhook, with an Action as fallback

**Recommended: a GitHub App with a `pull_request` webhook.**

- One install covers every repo in the org, so it scales to Regain's monorepo
  plus their sibling repos without per-repo setup.
- The customer sees exactly which permissions are granted, and can revoke in one
  click. For a medical company that audit trail matters more than convenience.
- Summon already has the delivery, retry, and status machinery in
  `plugin_webhooks` (`status: pending`, `externalId`), so failures are visible
  rather than silent.
- Reconciliation runs on Summon's side, which means the logic improves for every
  customer at once without them merging anything.

**Fallback: a repo-committed GitHub Action.** Correct when a customer will not
install an App (common in regulated orgs), or wants the reconciliation to run
inside their own boundary so no code content leaves it. Cost: it runs on their
Actions minutes, they must merge a workflow file to change behavior, and every
customer drifts to a different version.

Ship the App first, keep the Action as the compliance answer.

## Files to create or change

Create:

- `server/src/services/register-truth.ts` — the reconciler. Given a repo, a
  register file, and a commit range: parse findings, resolve each to a code
  claim, classify `closed | open | partial | contradicted`, attach evidence
  (`file:line`, closing commit, date).
- `server/src/services/register-truth-parsers.ts` — register format adapters.
  Markdown table first (what Regain uses), checkbox list second. Format sniffing
  belongs here, not in the reconciler.
- `packages/shared/src/types/register-truth.ts` — `Finding`, `FindingStatus`,
  `ReconciliationReceipt` shared between server and UI.
- `server/src/routes/register-truth.ts` — `POST /companies/:id/register-truth/run`
  (manual trigger, what the one-shot already does by hand) and
  `GET /companies/:id/register-truth/receipts`.
- `packages/plugins/paperclip-plugin-github-register/` — the webhook plugin:
  manifest, `handleWebhook` for `pull_request.closed`, enqueue a reconciliation.
- `doc/REGISTER-TRUTH-AGENT.md` — this file.

Change:

- `server/src/services/index.ts` — export the new service.
- `server/src/routes/index.ts` — mount the new routes.
- `packages/shared/src/index.ts` — export the new types.
- `packages/db/src/schema/` — one new table, `register_reconciliations`
  (company, repo, register path, commit range, findings JSON, receipt, status,
  created). This is the audit trail the customer is actually buying.

## Failure modes to design against, learned from the manual run

- **A stale clone lies.** The first pass ran against a checkout 41 commits
  behind and would have reported the wrong state. Always resolve against a fresh
  `origin/<default>`, never a local HEAD.
- **Pickaxe follows the wrong path across renames.** `git log -S` on a moved
  file returned a March commit for a July fix. Verify by checking the symbol's
  presence at the register's own commit, then walking forward, rather than
  trusting the first pickaxe hit.
- **Security findings must not auto-close.** P0-1 came back closed, but the
  front-desk route uses a different permission than the register asked for. The
  agent should mark security findings `needs-human` even when the code looks
  fixed.
- **Register scope beats repo scope.** "2,671 empty translation strings" was
  repo-wide and misleading; the register cited a specific line range where the
  real number was 7. Always measure inside the boundary the finding names.

## What ships in read-only mode

The receipt, and nothing else: a comment on the Summon task and a rendered diff
of the corrected register, exactly like `outbound/regain-register/`. Opening the
doc PR against the customer's repo is a second, separately enabled mode, and it
stays off until a customer asks for it.
